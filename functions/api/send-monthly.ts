/// <reference types="@cloudflare/workers-types" />

import type { ConfirmData } from '../../types';
import { buildMonthlyEmailHtml, buildMonthlyEmailSubject } from '../../lib/emailTemplate';
import type { SentRecord } from '../../types';
import { kvConfirmMonthPrefix, kvSentKey } from '../../lib/kvKeys';
import { authenticate, jsonResponse as jsonRes } from '../_shared/edgeHelpers';

interface Env {
  KINTAI_DATA: KVNamespace;
  API_KEY: string;
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (!authenticate(request, env.API_KEY)) {
    return jsonRes({ error: '認証に失敗しました' }, {}, 401);
  }

  if (request.method !== 'POST') {
    return jsonRes({ error: 'Method Not Allowed' }, {}, 405);
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

  const prefix = kvConfirmMonthPrefix(targetYear, targetMonth);

  // 対象月の確定済みエントリをすべて取得
  const list = await env.KINTAI_DATA.list({ prefix });

  if (list.keys.length === 0) {
    return jsonRes({ ok: true, message: `${targetYear}年${targetMonth}月分の確定データはありません`, sent: 0 }, {});
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
    return jsonRes({ ok: true, message: '有効な確定データがありません', sent: 0 }, {});
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
      return jsonRes({ error: 'メール送信に失敗しました', details: errorBody }, {}, 500);
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
    }, {});
  } catch (err) {
    return jsonRes({ error: 'メール送信中にエラーが発生しました', details: String(err) }, {}, 500);
  }
};
