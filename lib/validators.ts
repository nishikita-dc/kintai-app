import type { AbsentRecord, TimeChange, KvData } from '../types';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;
export const ABSENT_TYPES = new Set<string>(['有給', '欠勤', '振替休日', '祝日']);

export function isAbsentRecord(v: unknown): v is AbsentRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.date === 'string' &&
    DATE_RE.test(r.date) &&
    typeof r.type === 'string' &&
    ABSENT_TYPES.has(r.type) &&
    (r.name === undefined || typeof r.name === 'string')
  );
}

export function isTimeChange(v: unknown): v is TimeChange {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.date === 'string' &&
    DATE_RE.test(r.date) &&
    typeof r.inTime === 'string' &&
    TIME_RE.test(r.inTime) &&
    typeof r.outTime === 'string' &&
    TIME_RE.test(r.outTime)
  );
}

/**
 * KvData のランタイムバリデーション。
 * 型ガードではなく「変換済みオブジェクト | null」を返すことで、
 * 呼び出し側が boolean チェックと型アサーションを一度に済ませられる。
 */
export function validateKvData(data: unknown): KvData | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.extraWorkDays)) return null;
  if (!d.extraWorkDays.every((v: unknown) => typeof v === 'string' && DATE_RE.test(v))) return null;

  if (!Array.isArray(d.absentRecords)) return null;
  if (!d.absentRecords.every(isAbsentRecord)) return null;

  if (!Array.isArray(d.timeChanges)) return null;
  if (!d.timeChanges.every(isTimeChange)) return null;

  // extraHolidays は省略可能（後方互換）
  let extraHolidays: string[] | undefined;
  if (d.extraHolidays !== undefined) {
    if (!Array.isArray(d.extraHolidays)) return null;
    if (!d.extraHolidays.every((v: unknown) => typeof v === 'string' && DATE_RE.test(v))) return null;
    extraHolidays = d.extraHolidays as string[];
  }

  // overtimeWorkDays も省略可能
  let overtimeWorkDays: string[] | undefined;
  if (d.overtimeWorkDays !== undefined) {
    if (!Array.isArray(d.overtimeWorkDays)) return null;
    if (!d.overtimeWorkDays.every((v: unknown) => typeof v === 'string' && DATE_RE.test(v))) return null;
    overtimeWorkDays = d.overtimeWorkDays as string[];
  }

  return {
    extraWorkDays: d.extraWorkDays as string[],
    absentRecords: d.absentRecords as AbsentRecord[],
    timeChanges: d.timeChanges as TimeChange[],
    ...(extraHolidays !== undefined ? { extraHolidays } : {}),
    ...(overtimeWorkDays !== undefined ? { overtimeWorkDays } : {}),
  };
}
