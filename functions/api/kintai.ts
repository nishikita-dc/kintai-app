/// <reference types="@cloudflare/workers-types" />

interface Env {
  KINTAI_DATA: KVNamespace;
}

interface AbsentRecord {
  date: string;
  type: '有給' | '欠勤' | '振替休日' | '祝日';
  name?: string;
}

interface TimeChange {
  date: string;
  inTime: string;
  outTime: string;
}

interface KvData {
  extraWorkDays: string[];
  absentRecords: AbsentRecord[];
  timeChanges: TimeChange[];
}

interface PostBody {
  empId: string;
  year: number;
  month: number;
  data: KvData;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body: unknown, status = 200): Response {
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

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // GET /api/kintai?empId=1030&year=2026&month=4
  if (request.method === 'GET') {
    const empId = url.searchParams.get('empId');
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');

    if (!empId || !year || !month) {
      return jsonResponse({ error: 'empId, year, month は必須です' }, 400);
    }

    const key = buildKvKey(empId, year, month);
    const value = await env.KINTAI_DATA.get(key);

    // KV にデータがなければ null を返す
    return new Response(value ?? 'null', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST /api/kintai  body: { empId, year, month, data: { extraWorkDays, absentRecords, timeChanges } }
  if (request.method === 'POST') {
    let body: PostBody;
    try {
      body = (await request.json()) as PostBody;
    } catch {
      return jsonResponse({ error: '無効なJSONです' }, 400);
    }

    const { empId, year, month, data } = body;

    if (!empId || !year || !month || !data) {
      return jsonResponse({ error: 'empId, year, month, data は必須です' }, 400);
    }

    const key = buildKvKey(empId, year, month);
    await env.KINTAI_DATA.put(key, JSON.stringify(data));

    return jsonResponse({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
};
