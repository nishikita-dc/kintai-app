/// <reference types="@cloudflare/workers-types" />

interface Env {
  KINTAI_DATA: KVNamespace;
  API_KEY: string;
  SENDGRID_API_KEY: string;
  NOTIFY_EMAIL: string;
  SENDER_EMAIL: string;
}

interface ConfirmData {
  empId: string;
  empName: string;
  year: number;
  month: number;
  csv: string;
  confirmedAt: string;
}

function authenticate(request: Request, env: Env): boolean {
  const apiKey = env.API_KEY;
  if (!apiKey) return true;
  return request.headers.get('X-API-Key') === apiKey;
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function formatJST(isoStr: string): string {
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

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (!authenticate(request, env)) {
    return jsonRes({ error: '認証に失敗しました' }, 401);
  }

  if (request.method !== 'POST') {
    return jsonRes({ error: 'Method Not Allowed' }, 405);
  }

  // 対象年月を取得（デフォルト: 現在のJST月）
  let targetYear = 0;
  let targetMonth = 0;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.year === 'number') targetYear = body.year;
    if (typeof body.month === 'number') targetMonth = body.month;
  } catch {
    // bodyなしの場合はデフォルトを使用
  }

  if (!targetYear || !targetMonth) {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    targetYear = jst.getUTCFullYear();
    targetMonth = jst.getUTCMonth() + 1;
  }

  const monthStr = String(targetMonth).padStart(2, '0');
  const prefix = `confirmed:${targetYear}-${monthStr}:`;

  // 対象月の確定済みエントリをすべて取得
  const list = await env.KINTAI_DATA.list({ prefix });

  if (list.keys.length === 0) {
    return jsonRes({
      ok: true,
      message: `${targetYear}年${targetMonth}月分の確定データはありません`,
      sent: 0,
    });
  }

  const confirmedEntries: ConfirmData[] = [];
  for (const key of list.keys) {
    const raw = await env.KINTAI_DATA.get(key.name);
    if (raw) {
      try {
        confirmedEntries.push(JSON.parse(raw) as ConfirmData);
      } catch {
        /* skip invalid */
      }
    }
  }

  if (confirmedEntries.length === 0) {
    return jsonRes({
      ok: true,
      message: '有効な確定データがありません',
      sent: 0,
    });
  }

  // SendGrid API キーのチェック
  const sendgridApiKey = env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    return jsonRes(
      { error: 'SENDGRID_API_KEY が設定されていません。wrangler secret put SENDGRID_API_KEY で設定してください。' },
      500,
    );
  }

  const notifyEmail = env.NOTIFY_EMAIL || 'stardc666@gmail.com';
  const senderEmail = env.SENDER_EMAIL;
  if (!senderEmail) {
    return jsonRes(
      { error: 'SENDER_EMAIL が設定されていません。wrangler.toml で設定してください。' },
      500,
    );
  }

  // CSV添付ファイルを構築（UTF-8 BOM付き）
  const attachments = confirmedEntries.map((entry) => {
    const csvWithBom = '\uFEFF' + entry.csv;
    return {
      content: toBase64(csvWithBom),
      filename: `${entry.year}${String(entry.month).padStart(2, '0')}_${entry.empId}_${entry.empName}.csv`,
      type: 'text/csv',
      disposition: 'attachment' as const,
    };
  });

  // HTMLメール本文を構築
  const doctorRows = confirmedEntries
    .map(
      (e) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">${e.empId}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-weight:600;">${e.empName}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">${formatJST(e.confirmedAt)}</td>
        </tr>`,
    )
    .join('');

  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans',sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;">
  <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:white;padding:28px 24px;border-radius:12px 12px 0 0;">
    <h2 style="margin:0;font-size:18px;font-weight:700;">🦷 勤怠管理アプリ</h2>
    <p style="margin:6px 0 0;opacity:0.85;font-size:13px;">スター歯科クリニック 西宮北口駅前院</p>
  </div>
  <div style="background:white;padding:28px 24px;border:1px solid #e2e8f0;border-top:none;">
    <h3 style="color:#1e293b;margin:0 0 8px;font-size:16px;">
      【${targetYear}年${targetMonth}月分】勤怠データ
    </h3>
    <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 20px;">
      以下 <strong>${confirmedEntries.length}名</strong> のドクターの勤怠データが確定されました。<br>
      CSVファイルを添付していますのでご確認ください。
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">従業員コード</th>
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">名前</th>
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">確定日時</th>
        </tr>
      </thead>
      <tbody>${doctorRows}</tbody>
    </table>
  </div>
  <div style="padding:16px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;background:#f8fafc;">
    <p style="color:#94a3b8;font-size:11px;margin:0;text-align:center;">
      このメールは勤怠管理アプリから自動送信されています
    </p>
  </div>
</div>`;

  const subject = `【勤怠管理】${targetYear}年${targetMonth}月分 勤怠データ（${confirmedEntries.length}名分）`;

  // SendGrid API でメール送信
  try {
    const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: notifyEmail }] }],
        from: { email: senderEmail, name: '勤怠管理アプリ（スター歯科）' },
        subject,
        content: [{ type: 'text/html', value: htmlBody }],
        attachments,
      }),
    });

    // SendGrid は成功時 202 を返す
    if (sgRes.status !== 202 && !sgRes.ok) {
      const errorBody = await sgRes.text();
      return jsonRes(
        { error: 'メール送信に失敗しました', details: errorBody },
        500,
      );
    }

    return jsonRes({
      ok: true,
      message: `${confirmedEntries.length}名分のデータを ${notifyEmail} へ送信しました`,
      sent: confirmedEntries.length,
    });
  } catch (err) {
    return jsonRes(
      { error: 'メール送信中にエラーが発生しました', details: String(err) },
      500,
    );
  }
};
