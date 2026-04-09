/// <reference types="@cloudflare/workers-types" />

import type { ConfirmData, KvData, SentRecord } from '../../types';
import { DOCTOR_LIST } from '../../lib/constants';
import { getCorsHeaders, jsonResponse } from '../_shared/edgeHelpers';
import { kvConfirmMonthPrefix, kvKintaiKey, kvSentKey, KV_DOCTOR_LIST_KEY } from '../../lib/kvKeys';

interface Env {
  KINTAI_DATA: KVNamespace;
  ADMIN_API_KEY: string;
  ALLOWED_ORIGINS: string;
}

interface DoctorItem { id: string; name: string }

function authenticateAdmin(request: Request, adminApiKey: string): boolean {
  if (!adminApiKey) {
    console.warn('ADMIN_API_KEY が未設定です。');
    return false;
  }
  return request.headers.get('X-Admin-Key') === adminApiKey;
}

/** KVからドクターリストを取得。未設定の場合はデフォルトを返す */
async function getDoctorList(kv: KVNamespace): Promise<DoctorItem[]> {
  const raw = await kv.get(KV_DOCTOR_LIST_KEY);
  if (raw) {
    try { return JSON.parse(raw) as DoctorItem[]; } catch { /* fallback */ }
  }
  return DOCTOR_LIST;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env.ALLOWED_ORIGINS, 'GET, POST, OPTIONS');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!authenticateAdmin(request, env.ADMIN_API_KEY)) {
    return jsonResponse({ error: '認証に失敗しました' }, cors, 401);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // ── POST action=saveDoctors: ドクターリストをKVに保存 ──────────────
  if (request.method === 'POST' && action === 'saveDoctors') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: '無効なJSONです' }, cors, 400);
    }

    if (!Array.isArray(body)) {
      return jsonResponse({ error: 'ドクターリストは配列で指定してください' }, cors, 400);
    }

    for (const d of body) {
      if (typeof (d as DoctorItem).id !== 'string' || typeof (d as DoctorItem).name !== 'string') {
        return jsonResponse({ error: '各ドクターには id(string) と name(string) が必要です' }, cors, 400);
      }
    }

    await env.KINTAI_DATA.put(KV_DOCTOR_LIST_KEY, JSON.stringify(body));
    return jsonResponse({ ok: true }, cors);
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, cors, 405);
  }

  // ── action=doctors: ドクターリストを返す ──────────────────────────
  if (action === 'doctors') {
    const doctors = await getDoctorList(env.KINTAI_DATA);
    return jsonResponse({ doctors }, cors);
  }

  // ── action=months: 確定データが存在する月一覧を返す ──────────────
  if (action === 'months') {
    const months = new Set<string>();
    let cursor: string | undefined;

    do {
      const result: KVNamespaceListResult<unknown, string> = await env.KINTAI_DATA.list({
        prefix: 'confirmed:',
        cursor,
      });

      for (const key of result.keys) {
        const parts = key.name.split(':');
        if (parts.length >= 2) {
          months.add(parts[1]);
        }
      }

      cursor = result.list_complete ? undefined : (result as { cursor?: string }).cursor;
    } while (cursor);

    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
    return jsonResponse({ months: sortedMonths }, cors);
  }

  // ── action=status: 指定月の提出状況を返す ─────────────────────────
  if (action === 'status') {
    const yearStr = url.searchParams.get('year');
    const monthStr = url.searchParams.get('month');

    if (!yearStr || !monthStr) {
      return jsonResponse({ error: 'year, month は必須です' }, cors, 400);
    }

    const year = Number(yearStr);
    const month = Number(monthStr);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return jsonResponse({ error: 'year, month は正しい数値で指定してください' }, cors, 400);
    }

    const prefix = kvConfirmMonthPrefix(year, month);
    const listResult = await env.KINTAI_DATA.list({ prefix });

    type ConfirmEntry = Omit<ConfirmData, 'csv'> & { kintai?: KvData; sentAt?: string };
    const confirmedEntries: ConfirmEntry[] = [];

    for (const key of listResult.keys) {
      const raw = await env.KINTAI_DATA.get(key.name);
      if (!raw) continue;
      try {
        const data = JSON.parse(raw) as ConfirmData;
        const { csv: _csv, ...rest } = data;

        const kintaiRaw = await env.KINTAI_DATA.get(
          kvKintaiKey(data.empId, data.year, data.month),
        );
        let kintai: KvData | undefined;
        if (kintaiRaw) {
          try { kintai = JSON.parse(kintaiRaw) as KvData; } catch { /* skip */ }
        }

        const sentRaw = await env.KINTAI_DATA.get(
          kvSentKey(data.empId, data.year, data.month),
        );
        let sentAt: string | undefined;
        if (sentRaw) {
          try { sentAt = (JSON.parse(sentRaw) as SentRecord).sentAt; } catch { /* skip */ }
        }

        confirmedEntries.push({ ...rest, kintai, sentAt });
      } catch {
        // 壊れたデータはスキップ
      }
    }

    // KVのドクターリストを使って未確定者を算出
    const doctorList = await getDoctorList(env.KINTAI_DATA);
    const confirmedIds = new Set(confirmedEntries.map((e) => e.empId));
    const notConfirmed = doctorList.filter((d) => !confirmedIds.has(d.id));

    const doctorOrder = doctorList.map((d) => d.id);
    confirmedEntries.sort(
      (a, b) => doctorOrder.indexOf(a.empId) - doctorOrder.indexOf(b.empId),
    );

    return jsonResponse({ confirmed: confirmedEntries, notConfirmed }, cors);
  }

  return jsonResponse({ error: 'action パラメータが不正です（doctors / months / status を指定）' }, cors, 400);
};
