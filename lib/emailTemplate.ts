import type { ConfirmData } from '../types';
import { ADMIN_NAME } from './constants';

// ── HTML エスケープ ──────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 日付フォーマット ──────────────────────────────────────────
/** ISO 文字列を JST（日本標準時）の読みやすい形式に変換する（SSOT） */
export function formatJST(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

// ── ドクター 1名分のカード HTML ───────────────────────────────
function buildDoctorCard(entry: ConfirmData): string {
  const empId = escapeHtml(entry.empId);
  const empName = escapeHtml(entry.empName);
  const { confirmedAt, summary } = entry;

  const extraLabel =
    summary && summary.extraDays > 0 ? `（うち休日出勤 ${summary.extraDays}日）` : '';

  const summaryRows = summary
    ? `
        <tr>
          <td style="color:#64748b;padding:4px 0;width:110px;font-size:13px;">出勤日数</td>
          <td style="color:#1e293b;font-weight:600;font-size:13px;">${summary.workDays}日${extraLabel}</td>
        </tr>
        <tr>
          <td style="color:#64748b;padding:4px 0;font-size:13px;">有給取得</td>
          <td style="color:#1e293b;font-weight:600;font-size:13px;">${summary.absentPaid}日</td>
        </tr>
        <tr>
          <td style="color:#64748b;padding:4px 0;font-size:13px;">欠勤</td>
          <td style="color:#1e293b;font-weight:600;font-size:13px;">${summary.absentUnpaid}日</td>
        </tr>
        <tr>
          <td style="color:#64748b;padding:4px 0;font-size:13px;">振替休日</td>
          <td style="color:#1e293b;font-weight:600;font-size:13px;">${summary.absentSub}日</td>
        </tr>`
    : `<tr><td colspan="2" style="color:#94a3b8;font-size:13px;padding:4px 0;">集計データなし（旧フォーマット）</td></tr>`;

  return `
  <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:12px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 16px;">
          <span style="font-weight:700;color:#1e293b;font-size:14px;">${empName}</span>
          <span style="color:#94a3b8;font-size:12px;margin-left:8px;">ID: ${empId}</span>
        </td>
        <td style="padding:10px 16px;text-align:right;color:#64748b;font-size:12px;">
          確定: ${formatJST(confirmedAt)}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:10px 16px;">
          <table style="width:100%;border-collapse:collapse;">
            ${summaryRows}
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

// ── メール件名 ────────────────────────────────────────────────
export function buildMonthlyEmailSubject(
  year: number,
  month: number,
  count: number,
): string {
  return `【スター歯科】${year}年${month}月分 勤怠データ確定のご連絡（${count}名）`;
}

// ── メール本文 HTML ───────────────────────────────────────────
export function buildMonthlyEmailHtml(params: {
  year: number;
  month: number;
  entries: ConfirmData[];
}): string {
  const { year, month, entries } = params;
  const doctorCards = entries.map(buildDoctorCard).join('');
  const attachmentNames = entries
    .map((e) => `${e.empName}.csv`)
    .join('　/　');

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;">

  <!-- ヘッダー -->
  <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:white;padding:24px;border-radius:12px 12px 0 0;">
    <p style="margin:0;font-size:18px;font-weight:700;">🦷 スター歯科クリニック 西宮北口駅前院</p>
    <p style="margin:6px 0 0;opacity:0.85;font-size:13px;">${year}年${month}月分 勤怠データ確定のご連絡</p>
  </div>

  <!-- 本文 -->
  <div style="background:white;padding:28px 24px;border:1px solid #e2e8f0;border-top:none;">

    <p style="color:#1e293b;font-size:14px;margin:0 0 6px;font-weight:600;">${escapeHtml(ADMIN_NAME.replace(/さん$/, ''))}様</p>
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 24px;">
      お疲れ様です。<br>
      ${year}年${month}月分の勤怠データが確定されました（<strong>${entries.length}名</strong>）。<br>
      各ドクターのCSVファイルを添付していますのでご確認ください。
    </p>

    <!-- ドクターカード -->
    ${doctorCards}

    <!-- 添付ファイル一覧 -->
    <p style="color:#64748b;font-size:12px;margin:16px 0 0;padding:12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
      📎 添付ファイル：${attachmentNames}
    </p>

    <p style="color:#94a3b8;font-size:12px;margin:16px 0 0;padding-top:16px;border-top:1px solid #f1f5f9;">
      ※ 添付CSVは勤怠管理システムへの取り込み用フォーマットです。
    </p>
  </div>

  <!-- フッター -->
  <div style="padding:14px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;background:#f8fafc;">
    <p style="color:#94a3b8;font-size:11px;margin:0;text-align:center;">
      このメールは毎月末に勤怠管理アプリから自動送信されています
    </p>
  </div>

</div>`;
}
