/// <reference types="@cloudflare/workers-types" />

interface Env {
  KINTAI_DATA: KVNamespace;
  API_KEY: string;
  ALLOWED_ORIGINS: string;
}

interface ConfirmData {
  empId: string;
  empName: string;
  year: number;
  month: number;
  csv: string;
  confirmedAt: string;
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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

function buildConfirmKey(empId: string, year: number, month: number): string {
  const monthStr = String(month).padStart(2, '0');
  return `confirmed:${year}-${monthStr}:${empId}`;
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

  // GET /api/confirm?empId=xxx&year=xxx&month=xxx
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const empId = url.searchParams.get('empId');
    const year = Number(url.searchParams.get('year'));
    const month = Number(url.searchParams.get('month'));

    if (!empId || isNaN(year) || isNaN(month)) {
      return jsonResponse({ error: 'empId, year, month は必須です' }, cors, 400);
    }

    const key = buildConfirmKey(empId, year, month);
    const raw = await env.KINTAI_DATA.get(key);

    if (raw === null) {
      return jsonResponse({ confirmed: false }, cors);
    }

    try {
      const data = JSON.parse(raw) as ConfirmData;
      return jsonResponse({ confirmed: true, confirmedAt: data.confirmedAt }, cors);
    } catch {
      return jsonResponse({ confirmed: false }, cors);
    }
  }

  // POST /api/confirm  body: { empId, empName, year, month, csv }
  if (request.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: '無効なJSONです' }, cors, 400);
    }

    const { empId, empName, year, month, csv } = body;
    if (
      typeof empId !== 'string' ||
      typeof empName !== 'string' ||
      typeof year !== 'number' ||
      typeof month !== 'number' ||
      typeof csv !== 'string'
    ) {
      return jsonResponse({ error: 'empId, empName, year, month, csv は必須です' }, cors, 400);
    }

    const confirmedAt = new Date().toISOString();
    const key = buildConfirmKey(empId, year, month);
    const data: ConfirmData = { empId, empName, year, month, csv, confirmedAt };

    await env.KINTAI_DATA.put(key, JSON.stringify(data));

    return jsonResponse({ ok: true, confirmedAt }, cors);
  }

  // DELETE /api/confirm  body: { empId, year, month }
  if (request.method === 'DELETE') {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: '無効なJSONです' }, cors, 400);
    }

    const { empId, year, month } = body;
    if (typeof empId !== 'string' || typeof year !== 'number' || typeof month !== 'number') {
      return jsonResponse({ error: 'empId, year, month は必須です' }, cors, 400);
    }

    const key = buildConfirmKey(empId, year, month);
    await env.KINTAI_DATA.delete(key);

    return jsonResponse({ ok: true }, cors);
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
};
