/// <reference types="@cloudflare/workers-types" />

import type { DoctorConfig } from '../../types';
import { kvConfigKey } from '../../lib/kvKeys';
import { getCorsHeaders, authenticate, jsonResponse, isValidEmpId } from '../_shared/edgeHelpers';

interface Env {
  KINTAI_DATA: KVNamespace;
  API_KEY: string;
  ALLOWED_ORIGINS: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env.ALLOWED_ORIGINS);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!authenticate(request, env.API_KEY)) {
    return jsonResponse({ error: '認証に失敗しました' }, cors, 401);
  }

  const url = new URL(request.url);

  // GET /api/config?empId=1030
  if (request.method === 'GET') {
    const empId = url.searchParams.get('empId');
    if (!empId) {
      return jsonResponse({ error: 'empId は必須です' }, cors, 400);
    }
    if (!isValidEmpId(empId)) {
      return jsonResponse({ error: 'empId の形式が不正です' }, cors, 400);
    }

    const key = kvConfigKey(empId);
    const raw = await env.KINTAI_DATA.get(key);

    if (raw === null) {
      return jsonResponse(null, cors);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: '設定データの形式が不正です' }, cors, 500);
    }

    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof (parsed as Record<string, unknown>).weekdayHoliday !== 'number'
    ) {
      return jsonResponse({ error: '設定データのスキーマが不正です' }, cors, 500);
    }

    return jsonResponse(parsed, cors);
  }

  // POST /api/config  body: { empId, weekdayHoliday }
  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: '無効なJSONです' }, cors, 400);
    }

    const b = body as Record<string, unknown>;
    if (typeof b.empId !== 'string' || typeof b.weekdayHoliday !== 'number') {
      return jsonResponse({ error: 'empId(string), weekdayHoliday(number) は必須です' }, cors, 400);
    }
    if (!isValidEmpId(b.empId)) {
      return jsonResponse({ error: 'empId の形式が不正です' }, cors, 400);
    }

    const wd = b.weekdayHoliday as number;
    if (wd < 0 || wd > 6 || !Number.isInteger(wd)) {
      return jsonResponse({ error: 'weekdayHoliday は 0-6 の整数です' }, cors, 400);
    }

    const key = kvConfigKey(b.empId as string);
    const data: DoctorConfig = { weekdayHoliday: wd };
    await env.KINTAI_DATA.put(key, JSON.stringify(data));

    return jsonResponse({ ok: true }, cors);
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
};
