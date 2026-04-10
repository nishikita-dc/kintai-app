'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AbsentRecord, TimeChange } from '@/types';
import { getJapaneseHolidays } from '@/lib/constants';

interface UseScheduleParams {
  year: number;
  month: number;
  weekdayHoliday: number;
  enableSubstituteWork: boolean;
  isInitialized: boolean;
}

interface UseScheduleReturn {
  holidays: number[];
  extraWorkDays: string[];
  setExtraWorkDays: React.Dispatch<React.SetStateAction<string[]>>;
  absentRecords: AbsentRecord[];
  setAbsentRecords: React.Dispatch<React.SetStateAction<AbsentRecord[]>>;
  timeChanges: TimeChange[];
  setTimeChanges: React.Dispatch<React.SetStateAction<TimeChange[]>>;
  toggleDateStatus: (dateStr: string) => void;
  resetSchedule: () => void;
}

export function useSchedule({
  year,
  month,
  weekdayHoliday,
  enableSubstituteWork,
  isInitialized,
}: UseScheduleParams): UseScheduleReturn {
  const [extraWorkDays, setExtraWorkDays] = useState<string[]>([]);
  const [absentRecords, setAbsentRecords] = useState<AbsentRecord[]>([]);
  const [timeChanges, setTimeChanges] = useState<TimeChange[]>([]);

  const holidays = useMemo(
    () => [0, weekdayHoliday].sort((a, b) => a - b),
    [weekdayHoliday],
  );

  // 月・定休日が変わったら例外スケジュールを自動生成
  useEffect(() => {
    if (!isInitialized) return;

    // 動的に祝日を取得（隣接月も含めて月またぎの週を正しく判定）
    const yearHolidays = getJapaneseHolidays(year);
    // 前月・翌月が別年の場合にも対応
    const prevYear = month === 1 ? year - 1 : year;
    const nextYear = month === 12 ? year + 1 : year;
    const adjacentHolidays: Record<string, string> = {
      ...(prevYear !== year ? getJapaneseHolidays(prevYear) : {}),
      ...yearHolidays,
      ...(nextYear !== year ? getJapaneseHolidays(nextYear) : {}),
    };

    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const holidaysInMonth: AbsentRecord[] = Object.entries(yearHolidays)
      .filter(([date]) => date.startsWith(prefix))
      .map(([date, name]) => ({ date, type: '祝日' as const, name }));

    const substituteWorkDays: string[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(year, month - 1, d);
      const dayOfWeek = currentDate.getDay();
      const dateDisplay = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      // 定休曜日で、かつその日自体が祝日でない場合に振替出勤を検討
      if (dayOfWeek === weekdayHoliday && !adjacentHolidays[dateDisplay]) {
        // その週（日〜土）に祝日があるかチェック（月またぎ対応）
        const sun = new Date(currentDate);
        sun.setDate(currentDate.getDate() - dayOfWeek);

        let hasHolidayInWeek = false;
        for (let i = 0; i < 7; i++) {
          const check = new Date(sun);
          check.setDate(sun.getDate() + i);
          const ck = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`;
          if (adjacentHolidays[ck]) {
            hasHolidayInWeek = true;
            break;
          }
        }
        if (hasHolidayInWeek && enableSubstituteWork) {
          substituteWorkDays.push(dateDisplay);
        }
      }
    }

    setAbsentRecords(holidaysInMonth);
    setExtraWorkDays(substituteWorkDays);
    setTimeChanges([]);
  }, [year, month, weekdayHoliday, enableSubstituteWork, isInitialized]);

  // タップでステータスをサイクル切替
  // 通常出勤日: 通常 → 有給 → 欠勤 → 振替休日 → 通常
  // 定休曜日:   定休日 → 祝日週出勤 → 定休日
  // 祝日:       祝日 → 休日出勤 → 祝日
  // 日曜:       定休日 → 休日出勤 → 定休日
  const ABSENT_CYCLE: AbsentRecord['type'][] = ['有給', '欠勤', '振替休日'];

  const toggleDateStatus = useCallback(
    (dateStr: string) => {
      const dateYear = parseInt(dateStr.slice(0, 4), 10);
      const yearHolidays = getJapaneseHolidays(dateYear);
      const dayOfWeek = new Date(dateStr).getDay();
      const isExtra = extraWorkDays.includes(dateStr);
      const absentRec = absentRecords.find((r) => r.date === dateStr);
      const isNationalHoliday = !!yearHolidays[dateStr];
      const isSunday = dayOfWeek === 0;
      const isWeekdayHoliday = dayOfWeek === holidays.find((h) => h !== 0); // 日曜以外の定休曜日

      // ── 祝日の場合: 祝日 ↔ 休日出勤 ──
      if (isNationalHoliday) {
        if (absentRec?.type === '祝日') {
          // 祝日 → 休日出勤（extraに追加、absentの祝日はそのまま残す→リストに表示継続）
          setExtraWorkDays((prev) => [...prev, dateStr].sort());
          return;
        }
        if (isExtra) {
          // 休日出勤 → 祝日に戻す
          setExtraWorkDays((prev) => prev.filter((d) => d !== dateStr));
          return;
        }
        return;
      }

      // ── 日曜の場合: 定休日 ↔ 休日出勤 ──
      if (isSunday) {
        if (isExtra) {
          setExtraWorkDays((prev) => prev.filter((d) => d !== dateStr));
        } else {
          setExtraWorkDays((prev) => [...prev, dateStr].sort());
        }
        return;
      }

      // ── 定休曜日の場合: 定休日 ↔ 祝日週出勤 ──
      if (isWeekdayHoliday) {
        if (isExtra) {
          setExtraWorkDays((prev) => prev.filter((d) => d !== dateStr));
        } else {
          setExtraWorkDays((prev) => [...prev, dateStr].sort());
        }
        return;
      }

      // ── 通常出勤日の場合: 通常 → 有給 → 欠勤 → 振替休日 → 通常 ──
      if (!absentRec) {
        setAbsentRecords((prev) =>
          [...prev, { date: dateStr, type: '有給' as const }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        );
      } else if (absentRec.type === '祝日') {
        // 通常出勤日に祝日レコードがある場合は触らない
        return;
      } else {
        const currentIdx = ABSENT_CYCLE.indexOf(absentRec.type);
        const nextIdx = currentIdx + 1;

        if (nextIdx < ABSENT_CYCLE.length) {
          setAbsentRecords((prev) =>
            prev.map((r) =>
              r.date === dateStr ? { ...r, type: ABSENT_CYCLE[nextIdx] } : r,
            ),
          );
        } else {
          setAbsentRecords((prev) => prev.filter((r) => r.date !== dateStr));
        }
      }
    },
    [extraWorkDays, absentRecords, holidays],
  );

  const resetSchedule = useCallback(() => {
    setExtraWorkDays([]);
    setAbsentRecords([]);
    setTimeChanges([]);
  }, []);

  return {
    holidays,
    extraWorkDays,
    setExtraWorkDays,
    absentRecords,
    setAbsentRecords,
    timeChanges,
    setTimeChanges,
    toggleDateStatus,
    resetSchedule,
  };
}
