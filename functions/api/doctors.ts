/// <reference types="@cloudflare/workers-types" />

import { DOCTOR_LIST } from '../../lib/constants';
import { KV_DOCTOR_LIST_KEY } from '../../lib/kvKeys';
import { getCorsHeaders, jsonResponse } from '../_shared/edgeHelpers';

interface Env {
  KINTAI_DATA: KVNamespace;
  ALLOWED_ORIGINS: string;
}

/**
 * GET /api/doctors
 * KVに保存されたドクターリストを返す。未設定の場合はデフォルトを返す。
 * 認証不要（アプリのDr選択画面から利用）。
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env.ALLOWED_ORIGINS, 'GET, OPTIONS');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }

  const raw = await env.KINTAI_DATA.get(KV_DOCTOR_LIST_KEY);
  if (raw) {
    try {
      return jsonResponse({ doctors: JSON.parse(raw) }, cors);
    } catch { /* 壊れている場合はデフォルトへ */ }
  }

  return jsonResponse({ doctors: DOCTOR_LIST }, cors);
};
