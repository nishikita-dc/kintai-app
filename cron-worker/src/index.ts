/// <reference types="@cloudflare/workers-types" />

import { DOCTOR_LIST } from '../../lib/constants';
import { KV_DOCTOR_LIST_KEY, KV_LINE_GROUP_ID_KEY, kvConfirmMonthPrefix } from '../../lib/kvKeys';
import { pushTextToGroup, verifyLineSignature } from './line';
import { buildReminderMessage, type DoctorRef, type ReminderVariant } from './buildMessage';

interface Env {
  KINTAI_DATA: KVNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  KINTAI_APP_URL: string;
}

// ── 共通ユーティリティ ─────────────────────────────────────────────

/** 現在時刻を JST として { year, month, day, lastDayOfMonth } で返す */
function nowJst(): { year: number; month: number; day: number; lastDayOfMonth: number } {
  const utcMs = Date.now();
  const jst = new Date(utcMs + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  // 翌月1日の前日 = 今月末
  const last = new Date(Date.UTC(year, month, 0));
  return { year, month, day, lastDayOfMonth: last.getUTCDate() };
}

/** KV のドクターリストを取得。未保存なら DOCTOR_LIST フォールバック。 */
async function loadDoctorList(kv: KVNamespace): Promise<DoctorRef[]> {
  const raw = await kv.get(KV_DOCTOR_LIST_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as DoctorRef[];
    } catch { /* fallback */ }
  }
  return DOCTOR_LIST;
}

/** 指定月の未確定ドクター一覧を返す */
async function listUnconfirmedDoctors(
  kv: KVNamespace,
  year: number,
  month: number,
): Promise<DoctorRef[]> {
  const doctors = await loadDoctorList(kv);
  const prefix = kvConfirmMonthPrefix(year, month);
  const confirmedIds = new Set<string>();
  let cursor: string | undefined;
  do {
    const res: KVNamespaceListResult<unknown, string> = await kv.list({ prefix, cursor });
    for (const k of res.keys) {
      // key 形式: confirmed:YYYY-MM:{empId}
      const empId = k.name.split(':').pop();
      if (empId) confirmedIds.add(empId);
    }
    cursor = res.list_complete ? undefined : (res as { cursor?: string }).cursor;
  } while (cursor);

  return doctors.filter((d) => !confirmedIds.has(d.id));
}

/**
 * その日にリマインドを送るべきかを判定して variant を返す。
 * - 25日           → 'first'
 * - 月末最終日      → 'final'（28日が最終日となる2月非閏年も含む）
 * - 28日（最終日でない）→ 'middle'
 * - 上記以外（29/30/31 cron が最終日でない月に発火した場合など）→ null（スキップ）
 */
function detectVariant(day: number, lastDayOfMonth: number): ReminderVariant | null {
  if (day === lastDayOfMonth) return 'final';
  if (day === 25) return 'first';
  if (day === 28) return 'middle';
  return null;
}

/** リマインド送信のコアロジック（Cron / 手動テスト共通） */
async function runReminder(env: Env, opts: { forceVariant?: ReminderVariant } = {}): Promise<{ ok: boolean; message: string }> {
  const { year, month, day, lastDayOfMonth } = nowJst();

  const variant = opts.forceVariant ?? detectVariant(day, lastDayOfMonth);
  if (!variant) {
    return { ok: true, message: `${year}-${month}-${day}: 対象日ではないためスキップ。` };
  }

  const unconfirmed = await listUnconfirmedDoctors(env.KINTAI_DATA, year, month);

  if (unconfirmed.length === 0) {
    return { ok: true, message: `${year}-${month}: 全員確定済み。送信スキップ。` };
  }

  const groupId = await env.KINTAI_DATA.get(KV_LINE_GROUP_ID_KEY);
  if (!groupId) {
    return { ok: false, message: 'line_group_id が KV に未保存。Bot をグループに招待し発言してください。' };
  }

  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    return { ok: false, message: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です。' };
  }

  const text = buildReminderMessage({
    year,
    month,
    today: day,
    lastDayOfMonth,
    unconfirmed,
    appUrl: env.KINTAI_APP_URL || 'https://kintai-app-dyu.pages.dev',
    variant,
  });
  if (!text) return { ok: true, message: 'メッセージ生成スキップ' };

  const result = await pushTextToGroup(groupId, text, env.LINE_CHANNEL_ACCESS_TOKEN);
  if (!result.ok) {
    return { ok: false, message: `LINE Push 失敗 status=${result.status} body=${result.body}` };
  }
  return { ok: true, message: `[${variant}] ${unconfirmed.length}名分のリマインドをLINEへ送信しました` };
}

// ── Cron Trigger ハンドラ ──────────────────────────────────────────
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      const result = await runReminder(env);
      if (result.ok) console.log(`[cron ${event.cron}] ${result.message}`);
      else console.error(`[cron ${event.cron}] ${result.message}`);
    })());
  },

  // ── HTTP ハンドラ（LINE Webhook + 手動テスト） ───────────────────
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ヘルスチェック
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('kintai-line-reminder OK', { status: 200 });
    }

    // 手動テスト発火: GET /run?secret=<LINE_CHANNEL_SECRET>[&variant=first|middle|final]
    // variant 未指定時は今日の日付から自動判定（25/28/月末以外はスキップ）。
    if (request.method === 'GET' && url.pathname === '/run') {
      const provided = url.searchParams.get('secret') ?? '';
      if (!env.LINE_CHANNEL_SECRET || provided !== env.LINE_CHANNEL_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      const v = url.searchParams.get('variant');
      const forceVariant = v === 'first' || v === 'middle' || v === 'final' ? v : undefined;
      const result = await runReminder(env, { forceVariant });
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // LINE Webhook: POST /webhook
    if (request.method === 'POST' && url.pathname === '/webhook') {
      const rawBody = await request.text();
      const sig = request.headers.get('X-Line-Signature');
      const valid = await verifyLineSignature(rawBody, sig, env.LINE_CHANNEL_SECRET || '');
      if (!valid) {
        return new Response('Bad signature', { status: 401 });
      }

      try {
        const payload = JSON.parse(rawBody) as { events?: Array<{ source?: { type?: string; groupId?: string } }> };
        for (const ev of payload.events ?? []) {
          const groupId = ev.source?.groupId;
          if (groupId) {
            const existing = await env.KINTAI_DATA.get(KV_LINE_GROUP_ID_KEY);
            if (existing !== groupId) {
              await env.KINTAI_DATA.put(KV_LINE_GROUP_ID_KEY, groupId);
              console.log(`groupId saved: ${groupId}`);
            }
          }
        }
      } catch (err) {
        console.error('webhook parse error', err);
      }
      // LINE 側は素早い 200 を期待するので常に 200 を返す
      return new Response('OK', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },
};
