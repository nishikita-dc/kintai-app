/// <reference types="@cloudflare/workers-types" />

import type { ConfirmData } from '../../types';
import { getCorsHeaders, jsonResponse, isValidEmpId } from '../_shared/edgeHelpers';
import { kvConfirmKey } from '../../lib/kvKeys';

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
  const empId = url.searchParams.get('empId') ?? '';
  const year = Number(url.searchParams.get('year'));
  const month = Number(url.searchParams.get('month'));

  if (!empId || isNaN(year) || isNaN(month)) {
    return jsonResponse({ error: 'empId, year, month は必須です' }, cors, 400);
  }
  if (!isValidEmpId(empId)) {
    return jsonResponse({ error: 'empId の形式が不正です' }, cors, 400);
  }

  const key = kvConfirmKey(empId, year, month);
  const raw = await env.KINTAI_DATA.get(key);

  if (!raw) {
    return jsonResponse({ error: '確定データが見つかりません' }, cors, 404);
  }

  let data: ConfirmData;
  try {
    data = JSON.parse(raw) as ConfirmData;
  } catch {
    return jsonResponse({ error: 'データの解析に失敗しました' }, cors, 500);
  }

  const mm = String(data.month).padStart(2, '0');
  const filename = `${data.year}${mm}_${data.empId}_${data.empName}.csv`;

  // UTF-8 BOM 付きで返す（Excel で開いたとき文字化けしないように）
  const csvWithBom = '\uFEFF' + data.csv;
  const body = new TextEncoder().encode(csvWithBom);

  return new Response(body, {
    headers: {
      ...cors,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
};
