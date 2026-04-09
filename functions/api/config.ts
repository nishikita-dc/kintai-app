/// <reference types="@cloudflare/workers-types" />

import type { DoctorConfig } from '../../types';

interface Env {
  KINTAI_DATA: KVNamespace;
  API_KEY: string;
  ALLOWED_ORIGINS: string;
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedOrigin = allowed.includes(origin) ? origin : '';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    Vary: 'Origin',
  };
}

function authenticate(request: Request, env: Env): boolean {
  const apiKey = env.API_KEY;
  if (!apiKey) return true;
  return request.headers.get('X-API-Key') === apiKey;
}

function jsonResponse(body: unknown, corsHeaders: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!authenticate(request, env)) {
    return jsonResponse({ error: '認証に失敗しました' }, cors, 401);
  }

  const url = new URL(request.url);

  // GET /api/config?empId=1030
  if (request.method === 'GET') {
    const empId = url.searchParams.get('empId');
    if (!empId) {
      return jsonResponse({ error: 'empId は必須です' }, cors, 400);
    }

    const key = `config:${empId}`;
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

    const wd = b.weekdayHoliday as number;
    if (wd < 0 || wd > 6 || !Number.isInteger(wd)) {
      return jsonResponse({ error: 'weekdayHoliday は 0-6 の整数です' }, cors, 400);
    }

    const key = `config:${b.empId}`;
    const data: DoctorConfig = { weekdayHoliday: wd };
    await env.KINTAI_DATA.put(key, JSON.stringify(data));

    return jsonResponse({ ok: true }, cors);
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
};
