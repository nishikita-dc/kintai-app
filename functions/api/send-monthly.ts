/// <reference types="@cloudflare/workers-types" />

import type { ConfirmData } from '../../types';
import { buildMonthlyEmailHtml, buildMonthlyEmailSubject } from '../../lib/emailTemplate';
import type { SentRecord } from '../../types';
import { kvConfirmKey, kvConfirmMonthPrefix, kvSentKey } from '../../lib/kvKeys';
import { getCorsHeaders, authenticate, jsonResponse as jsonRes, isValidEmpId, isValidYearMonth } from '../_shared/edgeHelpers';

interface Env {
  KINTAI_DATA: KVNamespace;
  API_KEY: string;
  ALLOWED_ORIGINS: string;
  SENDGRID_API_KEY: string;
  NOTIFY_EMAIL: string;
  SENDER_EMAIL: string;
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** ConfirmData のランタイムバリデーション */
function isValidConfirmData(data: unknown): data is ConfirmData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.empId === 'string' &&
    typeof d.empName === 'string' &&
    typeof d.year === 'number' &&
    typeof d.month === 'number' &&
    typeof d.csv === 'string' &&
    typeof d.confirmedAt === 'string'
  );
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env.ALLOWED_ORIGINS, 'POST, OPTIONS');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!authenticate(request, env.API_KEY)) {
    return jsonRes({ error: '認証に失敗しました' }, cors, 401);
  }

  if (request.method !== 'POST') {
    return jsonRes({ error: 'Method Not Allowed' }, cors, 405);
  }

  // 対象年月・個別ドクターを取得
  let targetYear = 0;
  let targetMonth = 0;
  let targetEmpId: string | null = null;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.year === 'number') targetYear = body.year;
    if (typeof body.month === 'number') targetMonth = body.month;
    if (typeof body.empId === 'string') targetEmpId = body.empId;
  } catch {
    // bodyなしの場合はデフォルトを使用
  }

  if (targetEmpId && !isValidEmpId(targetEmpId)) {
    return jsonRes({ error: 'empId の形式が不正です' }, cors, 400);
  }

  if (!targetYear || !targetMonth) {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    targetYear = jst.getUTCFullYear();
    targetMonth = jst.getUTCMonth() + 1;
  }

  if (!isValidYearMonth(targetYear, targetMonth)) {
    return jsonRes({ error: 'year/month の値が不正です' }, cors, 400);
  }

  // empId 指定時は個別ドクターのみ、未指定時は全員分
  const confirmedEntries: ConfirmData[] = [];

  if (targetEmpId) {
    // 個別送信: 指定ドクターの確定データのみ取得
    const key = kvConfirmKey(targetEmpId, targetYear, targetMonth);
    const raw = await env.KINTAI_DATA.get(key);
    if (!raw) {
      return jsonRes({ ok: false, error: `${targetYear}年${targetMonth}月分の確定データがありません`, sent: 0 }, cors, 400);
    }
    try {
      const parsed = JSON.parse(raw);
      if (isValidConfirmData(parsed)) {
        confirmedEntries.push(parsed);
      }
    } catch { /* invalid */ }
  } else {
    // 全員送信: 対象月の確定済みエントリをすべて取得
    const prefix = kvConfirmMonthPrefix(targetYear, targetMonth);
    const list = await env.KINTAI_DATA.list({ prefix });

    if (list.keys.length === 0) {
      return jsonRes({ ok: true, message: `${targetYear}年${targetMonth}月分の確定データはありません`, sent: 0 }, cors);
    }

    for (const k of list.keys) {
      const raw = await env.KINTAI_DATA.get(k.name);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (isValidConfirmData(parsed)) {
            confirmedEntries.push(parsed);
          }
        } catch { /* skip */ }
      }
    }
  }

  if (confirmedEntries.length === 0) {
    return jsonRes({ ok: true, message: '有効な確定データがありません', sent: 0 }, cors);
  }

  // SendGrid API キーのチェック
  const sendgridApiKey = env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    return jsonRes(
      { error: 'SENDGRID_API_KEY が設定されていません。wrangler secret put SENDGRID_API_KEY で設定してください。' },
      {}, 500,
    );
  }

  const notifyEmail = env.NOTIFY_EMAIL || 'stardc666@gmail.com';
  const senderEmail = env.SENDER_EMAIL;
  if (!senderEmail) {
    return jsonRes(
      { error: 'SENDER_EMAIL が設定されていません。wrangler.toml で設定してください。' },
      {}, 500,
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

  const htmlBody = buildMonthlyEmailHtml({ year: targetYear, month: targetMonth, entries: confirmedEntries });
  const subject = buildMonthlyEmailSubject(targetYear, targetMonth, confirmedEntries.length);

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

    if (sgRes.status !== 202 && !sgRes.ok) {
      const errorBody = await sgRes.text();
      return jsonRes({ error: 'メール送信に失敗しました', details: errorBody }, cors, 500);
    }

    // 送信成功後、各ドクターの sent: KV キーを記録
    const sentAt = new Date().toISOString();
    await Promise.all(
      confirmedEntries.map((entry) => {
        const record: SentRecord = {
          empId: entry.empId,
          year: targetYear,
          month: targetMonth,
          sentAt,
        };
        return env.KINTAI_DATA.put(
          kvSentKey(entry.empId, targetYear, targetMonth),
          JSON.stringify(record),
        );
      }),
    );

    return jsonRes({
      ok: true,
      message: `${confirmedEntries.length}名分のデータを ${notifyEmail} へ送信しました`,
      sent: confirmedEntries.length,
    }, cors);
  } catch (err) {
    return jsonRes({ error: 'メール送信中にエラーが発生しました', details: String(err) }, cors, 500);
  }
};
