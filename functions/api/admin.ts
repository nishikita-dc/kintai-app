/// <reference types="@cloudflare/workers-types" />

import type { ConfirmData, KvData } from '../../types';
import { DOCTOR_LIST } from '../../lib/constants';
import { getCorsHeaders, jsonResponse } from '../_shared/edgeHelpers';
import { kvConfirmMonthPrefix, kvKintaiKey } from '../../lib/kvKeys';

interface Env {
  KINTAI_DATA: KVNamespace;
  ADMIN_API_KEY: string;
  ALLOWED_ORIGINS: string;
}

function authenticateAdmin(request: Request, adminApiKey: string): boolean {
  if (!adminApiKey) {
    console.warn('ADMIN_API_KEY が未設定です。');
    return false;
  }
  return request.headers.get('X-Admin-Key') === adminApiKey;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env.ALLOWED_ORIGINS, 'GET, OPTIONS');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!authenticateAdmin(request, env.ADMIN_API_KEY)) {
    return jsonResponse({ error: '認証に失敗しました' }, cors, 401);
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, cors, 405);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // ── action=months: 確定データが存在する月一覧を返す ──────────────
  if (action === 'months') {
    const months = new Set<string>();
    let cursor: string | undefined;

    // KV.list() は最大 1000 件のため、ページネーション対応
    do {
      const result: KVNamespaceListResult<unknown, string> = await env.KINTAI_DATA.list({
        prefix: 'confirmed:',
        cursor,
      });

      for (const key of result.keys) {
        // キー形式: confirmed:{YYYY-MM}:{empId}
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

    type ConfirmEntry = Omit<ConfirmData, 'csv'> & { kintai?: KvData };
    const confirmedEntries: ConfirmEntry[] = [];

    for (const key of listResult.keys) {
      const raw = await env.KINTAI_DATA.get(key.name);
      if (!raw) continue;
      try {
        const data = JSON.parse(raw) as ConfirmData;
        // CSV は含めず必要なフィールドのみ返す（レスポンスを軽量化）
        const { csv: _csv, ...rest } = data;

        // kintai 例外データ（欠勤種別・振替出勤日など）を追加取得
        const kintaiRaw = await env.KINTAI_DATA.get(
          kvKintaiKey(data.empId, data.year, data.month),
        );
        let kintai: KvData | undefined;
        if (kintaiRaw) {
          try { kintai = JSON.parse(kintaiRaw) as KvData; } catch { /* skip */ }
        }

        confirmedEntries.push({ ...rest, kintai });
      } catch {
        // 壊れたデータはスキップ
      }
    }

    // 未確定のドクターを算出
    const confirmedIds = new Set(confirmedEntries.map((e) => e.empId));
    const notConfirmed = DOCTOR_LIST.filter((d) => !confirmedIds.has(d.id));

    // 確定済みをドクターマスタの順番に並べ替え
    const doctorOrder = DOCTOR_LIST.map((d) => d.id);
    confirmedEntries.sort(
      (a, b) => doctorOrder.indexOf(a.empId) - doctorOrder.indexOf(b.empId),
    );

    return jsonResponse({ confirmed: confirmedEntries, notConfirmed }, cors);
  }

  return jsonResponse({ error: 'action パラメータが不正です（months または status を指定）' }, cors, 400);
};
