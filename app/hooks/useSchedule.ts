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
  extraHolidays: string[];
  setExtraHolidays: React.Dispatch<React.SetStateAction<string[]>>;
  overtimeWorkDays: string[];
  setOvertimeWorkDays: React.Dispatch<React.SetStateAction<string[]>>;
  toggleDateStatus: (dateStr: string) => void;
  resetSchedule: () => void;
  resetToDefault: () => void;
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
  const [extraHolidays, setExtraHolidays] = useState<string[]>([]); // 追加定休日
  const [overtimeWorkDays, setOvertimeWorkDays] = useState<string[]>([]); // 休日出勤フラグ

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
      // 祝日の日は他の種別（有給・欠勤・振替休日）に変更せず、
      // 祝日（休み）↔ 休日出勤 の2択のみ
      if (isNationalHoliday) {
        // 手動で設定された有給・欠勤・振替休日があれば先にクリア
        if (absentRec && absentRec.type !== '祝日') {
          setAbsentRecords((prev) => prev.filter((r) => r.date !== dateStr));
          // 祝日レコードを復元
          const holidayName = yearHolidays[dateStr];
          setAbsentRecords((prev) =>
            [...prev, { date: dateStr, type: '祝日' as const, name: holidayName }].sort((a, b) =>
              a.date.localeCompare(b.date),
            ),
          );
          return;
        }

        if (isExtra) {
          // 休日出勤 → 祝日に戻す
          setExtraWorkDays((prev) => prev.filter((d) => d !== dateStr));
        } else {
          // 祝日 → 休日出勤
          setExtraWorkDays((prev) => [...prev, dateStr].sort());
        }
        return;
      }

      // ── 日曜の場合: 定休日 ↔ 休日出勤 ──
      if (isSunday) {
        // 手動の有給等があればクリア
        if (absentRec) {
          setAbsentRecords((prev) => prev.filter((r) => r.date !== dateStr));
        }
        if (isExtra) {
          setExtraWorkDays((prev) => prev.filter((d) => d !== dateStr));
        } else {
          setExtraWorkDays((prev) => [...prev, dateStr].sort());
        }
        return;
      }

      // ── 定休曜日の場合 ──
      if (isWeekdayHoliday) {
        if (absentRec) {
          setAbsentRecords((prev) => prev.filter((r) => r.date !== dateStr));
        }
        const isOvertime = overtimeWorkDays.includes(dateStr);

        if (!isExtra) {
          // 定休日 → 振替出勤（extraに追加）
          setExtraWorkDays((prev) => [...prev, dateStr].sort());
          setOvertimeWorkDays((prev) => prev.filter((d) => d !== dateStr));
        } else if (!isOvertime) {
          // 振替出勤 → 休日出勤（overtimeに追加）
          setOvertimeWorkDays((prev) => [...prev, dateStr].sort());
        } else {
          // 休日出勤 → 定休日（両方クリア）
          setExtraWorkDays((prev) => prev.filter((d) => d !== dateStr));
          setOvertimeWorkDays((prev) => prev.filter((d) => d !== dateStr));
        }
        return;
      }

      // ── 通常出勤日の場合: 通常 → 有給 → 欠勤 → 振替休日 → 通常 ──
      // extraが残っていたらクリア
      if (isExtra) {
        setExtraWorkDays((prev) => prev.filter((d) => d !== dateStr));
      }

      if (!absentRec) {
        setAbsentRecords((prev) =>
          [...prev, { date: dateStr, type: '有給' as const }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        );
      } else if (absentRec.type === '祝日') {
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
    [extraWorkDays, absentRecords, holidays, overtimeWorkDays, extraHolidays],
  );

  const resetSchedule = useCallback(() => {
    setExtraWorkDays([]);
    setAbsentRecords([]);
    setTimeChanges([]);
    setExtraHolidays([]);
    setOvertimeWorkDays([]);
  }, []);

  // 当月データをデフォルト（自動生成）にリセット
  // useEffect の自動生成ロジックを再実行するため、一度クリアしてからフラグで再生成
  const resetToDefault = useCallback(() => {
    setExtraWorkDays([]);
    setAbsentRecords([]);
    setTimeChanges([]);
    setExtraHolidays([]);
    setOvertimeWorkDays([]);

    // 自動生成ロジックを再実行（useEffectの依存値が変わらないので手動で実行）
    const yearHols = getJapaneseHolidays(year);
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const holidaysInMonth: AbsentRecord[] = Object.entries(yearHols)
      .filter(([date]) => date.startsWith(prefix))
      .map(([date, name]) => ({ date, type: '祝日' as const, name }));

    const adjacentHolidays: Record<string, string> = {
      ...(month === 1 ? getJapaneseHolidays(year - 1) : {}),
      ...yearHols,
      ...(month === 12 ? getJapaneseHolidays(year + 1) : {}),
    };

    const subWorkDays: string[] = [];
    const dim = new Date(year, month, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const cur = new Date(year, month - 1, d);
      const dow = cur.getDay();
      const dd = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dow === weekdayHoliday && !adjacentHolidays[dd]) {
        const sun = new Date(cur);
        sun.setDate(cur.getDate() - dow);
        for (let i = 0; i < 7; i++) {
          const chk = new Date(sun);
          chk.setDate(sun.getDate() + i);
          const ck = `${chk.getFullYear()}-${String(chk.getMonth() + 1).padStart(2, '0')}-${String(chk.getDate()).padStart(2, '0')}`;
          if (adjacentHolidays[ck]) { subWorkDays.push(dd); break; }
        }
      }
    }

    setAbsentRecords(holidaysInMonth);
    setExtraWorkDays(subWorkDays);
  }, [year, month, weekdayHoliday]);

  return {
    holidays,
    extraWorkDays,
    setExtraWorkDays,
    absentRecords,
    setAbsentRecords,
    timeChanges,
    setTimeChanges,
    extraHolidays,
    setExtraHolidays,
    overtimeWorkDays,
    setOvertimeWorkDays,
    toggleDateStatus,
    resetSchedule,
    resetToDefault,
  };
}
