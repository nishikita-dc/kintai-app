/// <reference types="@cloudflare/workers-types" />

import type { ConfirmData } from '../../types';
import { kvConfirmKey } from '../../lib/kvKeys';
import { getCorsHeaders, authenticate, jsonResponse, isValidEmpId, isValidYearMonth } from '../_shared/edgeHelpers';

interface Env {
  KINTAI_DATA: KVNamespace;
  API_KEY: string;
  ALLOWED_ORIGINS: string;
}


export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  // confirm は DELETE も許可
  const cors = getCorsHeaders(request, env.ALLOWED_ORIGINS, 'GET, POST, DELETE, OPTIONS');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!authenticate(request, env.API_KEY)) {
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
    if (!isValidEmpId(empId)) {
      return jsonResponse({ error: 'empId の形式が不正です' }, cors, 400);
    }
    if (!isValidYearMonth(year, month)) {
      return jsonResponse({ error: 'year/month の値が不正です' }, cors, 400);
    }

    const key = kvConfirmKey(empId, year, month);
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

    const { empId, empName, year, month, csv, summary } = body;
    if (
      typeof empId !== 'string' ||
      typeof empName !== 'string' ||
      typeof year !== 'number' ||
      typeof month !== 'number' ||
      typeof csv !== 'string'
    ) {
      return jsonResponse({ error: 'empId, empName, year, month, csv は必須です' }, cors, 400);
    }
    if (!isValidEmpId(empId)) {
      return jsonResponse({ error: 'empId の形式が不正です' }, cors, 400);
    }

    // summary は省略可能。存在する場合だけ数値チェック
    type SummaryShape = ConfirmData['summary'];
    let validatedSummary: SummaryShape;
    if (summary !== undefined && typeof summary === 'object' && summary !== null) {
      const s = summary as Record<string, unknown>;
      if (
        typeof s.workDays === 'number' &&
        typeof s.extraDays === 'number' &&
        typeof s.absentPaid === 'number' &&
        typeof s.absentUnpaid === 'number' &&
        typeof s.absentSub === 'number'
      ) {
        validatedSummary = {
          workDays: s.workDays,
          extraDays: s.extraDays,
          absentPaid: s.absentPaid,
          absentUnpaid: s.absentUnpaid,
          absentSub: s.absentSub,
        };
      }
    }

    const confirmedAt = new Date().toISOString();
    const key = kvConfirmKey(empId, year, month);
    const data: ConfirmData = {
      empId,
      empName,
      year,
      month,
      csv,
      confirmedAt,
      ...(validatedSummary !== undefined ? { summary: validatedSummary } : {}),
    };

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
    if (!isValidEmpId(empId as string)) {
      return jsonResponse({ error: 'empId の形式が不正です' }, cors, 400);
    }

    const key = kvConfirmKey(empId as string, year as number, month as number);
    await env.KINTAI_DATA.delete(key);

    return jsonResponse({ ok: true }, cors);
  }

  return new Response('Method Not Allowed', { status: 405, headers: cors });
};
