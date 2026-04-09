import type { DoctorItem } from '@/types';
import { getHolidaysForYear } from './holidays';

// ── 祝日（動的計算 + キャッシュ） ─────────────────────────────────
const holidayCache = new Map<number, Record<string, string>>();

/**
 * 指定年の祝日マップを取得する（キャッシュ付き）。
 * 複数年にまたがるアクセスにも対応。
 */
export function getJapaneseHolidays(year: number): Record<string, string> {
  let cached = holidayCache.get(year);
  if (!cached) {
    cached = getHolidaysForYear(year);
    holidayCache.set(year, cached);
  }
  return cached;
}

/**
 * 後方互換: 既存コードの JAPANESE_HOLIDAYS[dateStr] パターンをサポートするプロキシ。
 * holidays["2026-04-29"] のようにアクセスすると、その年のマップから自動取得する。
 */
export const JAPANESE_HOLIDAYS: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  {
    get(_target, prop: string) {
      if (typeof prop !== 'string' || !/^\d{4}-/.test(prop)) return undefined;
      const year = parseInt(prop.slice(0, 4), 10);
      return getJapaneseHolidays(year)[prop];
    },
    has(_target, prop: string) {
      if (typeof prop !== 'string' || !/^\d{4}-/.test(prop)) return false;
      const year = parseInt(prop.slice(0, 4), 10);
      return prop in getJapaneseHolidays(year);
    },
    ownKeys() {
      // entries() 用: 現在年 ± 1年分のキーを返す
      const currentYear = new Date().getFullYear();
      const keys: string[] = [];
      for (let y = currentYear - 1; y <= currentYear + 1; y++) {
        keys.push(...Object.keys(getJapaneseHolidays(y)));
      }
      return keys;
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      if (typeof prop !== 'string' || !/^\d{4}-/.test(prop)) return undefined;
      const year = parseInt(prop.slice(0, 4), 10);
      const val = getJapaneseHolidays(year)[prop];
      if (val === undefined) return undefined;
      return { configurable: true, enumerable: true, value: val };
    },
  },
);

// ── 曜日名（日本語）────────────────────────────────────────────────
/** 日〜土の曜日名（インデックス = Date.getDay() の戻り値） */
export const WEEK_DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;
export type WeekDayJa = (typeof WEEK_DAYS_JA)[number];

// ── 欠勤種別 ─────────────────────────────────────────────────────
/** ユーザーが手動で選択できる欠勤種別（祝日は自動付与のため含めない） */
export const USER_ABSENT_TYPES = ['有給', '欠勤', '振替休日'] as const;
export type UserAbsentType = (typeof USER_ABSENT_TYPES)[number];

// ── デフォルト勤務時間 ────────────────────────────────────────────
export interface DefaultTimes {
  inTime: string;     // "09:00"
  outTime: string;    // "19:30"
}

/**
 * 曜日ごとのデフォルト出退勤時刻。
 * 水曜(3)と土曜(6)は早い退勤。
 */
export const DEFAULT_WORK_TIMES: Record<number, DefaultTimes> = {
  0: { inTime: '09:00', outTime: '19:30' }, // 日（通常は休み）
  1: { inTime: '09:00', outTime: '19:30' }, // 月
  2: { inTime: '09:00', outTime: '19:30' }, // 火
  3: { inTime: '09:00', outTime: '17:30' }, // 水
  4: { inTime: '09:00', outTime: '19:30' }, // 木
  5: { inTime: '09:00', outTime: '19:30' }, // 金
  6: { inTime: '09:00', outTime: '17:30' }, // 土
};

export const DOCTOR_LIST: DoctorItem[] = [
  { id: '1030', name: '生野' },
  { id: '1017', name: '露口' },
  { id: '1016', name: '松浦' },
  { id: '1059', name: '藤田' },
  { id: '1023', name: '加藤' },
  { id: '1033', name: '岸元' },
  { id: '1020', name: '安達' },
  { id: '1013', name: '松本' },
  { id: '1019', name: '久保' },
  { id: '1036', name: '落窪' },
  { id: '1063', name: '山本' },
  { id: '1040', name: '岡田' },
  { id: '1047', name: '珠央' },
  { id: '1084', name: '末松' },
  { id: '1085', name: '水田' },
  { id: '1086', name: '有馬' },
  { id: '1087', name: '辰己' },
  { id: '1088', name: '楠元' },
  { id: '1089', name: '桑迫' },
];
