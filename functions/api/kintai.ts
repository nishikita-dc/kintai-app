/// <reference types="@cloudflare/workers-types" />

import type { AbsentRecord, TimeChange, KvData, PostBody } from '../../types';
import { validateKvData } from '../../lib/validators';

interface Env {
  KINTAI_DATA: KVNamespace;
  API_KEY: string;
  ALLOWED_ORIGINS: string; // カンマ区切り: "https://example.com,https://dev.example.com"
}

// ── CORS: 許可オリジンのみ ──────────────────────────
function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // 許可リストに含まれるオリジンだけ反映。含まれなければヘッダーを返さない
  const allowedOrigin = allowed.includes(origin) ? origin : '';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    Vary: 'Origin',
  };
}

// ── 認証: X-API-Key ヘッダーで検証 ────────────────────
function authenticate(request: Request, env: Env): boolean {
  const apiKey = env.API_KEY;
  if (!apiKey) return true; // 未設定時はスキップ（開発用）
  return request.headers.get('X-API-Key') === apiKey;
}

function jsonResponse(body: unknown, corsHeaders: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildKvKey(empId: string, year: string | number, month: string | number): string {
  const monthStr = String(Number(month)).padStart(2, '0');
  return `kintai:${empId}:${year}-${monthStr}`;
}


export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // ── 認証チェック ─────────────────────────────────
  if (!authenticate(request, env)) {
    return jsonResponse({ error: '認証に失敗しました' }, cors, 401);
  }

  const url = new URL(request.url);

  // GET /api/kintai?empId=1030&year=2026&month=4
  if (request.method === 'GET') {
    const empId = url.searchParams.get('empId');
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');

    if (!empId || !year || !month) {
      return jsonResponse({ error: 'empId, year, month は必須です' }, cors, 400);
    }

    const key = buildKvKey(empId, year, month);
    const raw = await env.KINTAI_DATA.get(key);

    if (raw === null) {
      return jsonResponse(null, cors);
    }

    // KV から取得したデータをバリデーション
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: 'KV データの形式が不正です' }, cors, 500);
    }

    const validated = validateKvData(parsed);
    if (!validated) {
      return jsonResponse({ error: 'KV データのスキーマが不正です' }, cors, 500);
    }

    return jsonResponse(validated, cors);
  }

  // POST /api/kintai  body: { empId, year, month, data: { extraWorkDays, absentRecords, timeChanges } }
  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: '無効なJSONです' }, cors, 400);
    }

    const b = body as Record<string, unknown>;
    const empId = b.empId;
    const year = b.year;
    const month = b.month;
    const data = b.data;

    if (typeof empId !== 'string' || typeof year !== 'number' || typeof month !== 'number' || !data) {
      return jsonResponse({ error: 'empId(string), year(number), month(number), data は必須です' }, cors, 400);
    }

    // POST ボディの data もバリデーション
    const validated = validateKvData(data);
    if (!validated) {
      return jsonResponse({ error: 'data のスキーマが不正です' }, cors, 400);
    }

    const key = buildKvKey(empId, year, month);
    await env.KINTAI_DATA.put(key, JSON.stringify(validated));

    return jsonResponse({ ok: true }, cors);
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
};
