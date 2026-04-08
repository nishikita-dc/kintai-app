import type { KvData } from '@/types';

// ── API キー（環境変数から注入） ──────────────────────
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? '';

/** API 呼び出し用ヘッダーを生成（API キー付き） */
export function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  return h;
}

// ── KvData のランタイムバリデーション ──────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const ABSENT_TYPES = new Set(['有給', '欠勤', '振替休日', '祝日']);

export function isValidKvData(data: unknown): data is KvData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.extraWorkDays)) return false;
  if (!d.extraWorkDays.every((v: unknown) => typeof v === 'string' && DATE_RE.test(v))) return false;

  if (!Array.isArray(d.absentRecords)) return false;
  if (
    !d.absentRecords.every((v: unknown) => {
      if (typeof v !== 'object' || v === null) return false;
      const r = v as Record<string, unknown>;
      return (
        typeof r.date === 'string' && DATE_RE.test(r.date) &&
        typeof r.type === 'string' && ABSENT_TYPES.has(r.type) &&
        (r.name === undefined || typeof r.name === 'string')
      );
    })
  ) return false;

  if (!Array.isArray(d.timeChanges)) return false;
  if (
    !d.timeChanges.every((v: unknown) => {
      if (typeof v !== 'object' || v === null) return false;
      const r = v as Record<string, unknown>;
      return (
        typeof r.date === 'string' && DATE_RE.test(r.date) &&
        typeof r.inTime === 'string' && TIME_RE.test(r.inTime) &&
        typeof r.outTime === 'string' && TIME_RE.test(r.outTime)
      );
    })
  ) return false;

  return true;
}
