'use client';

import React, { useMemo, useRef, useCallback } from 'react';
import type { AbsentRecord } from '@/types';
import { JAPANESE_HOLIDAYS, WEEK_DAYS_JA } from '@/lib/constants';

interface CalendarViewProps {
  year: number;
  month: number;
  holidays: number[];
  weekdayHoliday: number;
  extraWorkDays: string[];
  absentRecords: AbsentRecord[];
  onToggleDate: (dateStr: string) => void;
  disabled?: boolean;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
}

const WEEK_LABELS = WEEK_DAYS_JA;

function CalendarView({
  year,
  month,
  holidays,
  weekdayHoliday,
  extraWorkDays,
  absentRecords,
  onToggleDate,
  disabled = false,
  onSwipePrev,
  onSwipeNext,
}: CalendarViewProps) {
  // スワイプ検出
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    // 水平方向のスワイプのみ検出（垂直スクロールと区別）
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) onSwipePrev?.();
      else onSwipeNext?.();
    }
    touchStart.current = null;
  }, [onSwipePrev, onSwipeNext]);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  // O(1) ルックアップ用 Map（O(n*m) → O(n) に改善）
  const extraSet = useMemo(() => new Set(extraWorkDays), [extraWorkDays]);
  const absentMap = useMemo(
    () => new Map(absentRecords.map((r) => [r.date, r])),
    [absentRecords],
  );

  const cells: React.ReactNode[] = [];

  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const todayDate = today.getDate();

  for (let i = 0; i < firstDay; i++) {
    cells.push(
      <div key={`empty-${i}`} className="h-20 bg-slate-50/50 rounded-xl" />,
    );
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();

    const isExtra = extraSet.has(dateStr);
    const absentRec = absentMap.get(dateStr);
    const isHoliday = holidays.includes(dayOfWeek);
    const isNationalHoliday = !!JAPANESE_HOLIDAYS[dateStr];

    let statusLabel = '';
    let bgColor = 'bg-white dark:bg-slate-800';
    let textColor = 'text-slate-700 dark:text-slate-200';
    let borderColor = 'border-slate-200';

    if (isExtra) {
      if (isNationalHoliday || isHoliday) {
        if (dayOfWeek === weekdayHoliday) {
          statusLabel = '祝日週出勤';
          bgColor = 'bg-amber-50 dark:bg-amber-900/30';
          textColor = 'text-amber-700 dark:text-amber-300';
          borderColor = 'border-amber-200';
        } else {
          statusLabel = '休日出勤';
          bgColor = 'bg-orange-50 dark:bg-orange-900/30';
          textColor = 'text-orange-700 dark:text-orange-300';
          borderColor = 'border-orange-200';
        }
      }
    } else if (absentRec) {
      statusLabel = absentRec.type;
      if (absentRec.type === '有給') {
        bgColor = 'bg-emerald-50 dark:bg-emerald-900/30';
        textColor = 'text-emerald-700 dark:text-emerald-300';
        borderColor = 'border-emerald-200';
      } else if (absentRec.type === '欠勤') {
        bgColor = 'bg-red-50 dark:bg-red-900/30';
        textColor = 'text-red-700 dark:text-red-300';
        borderColor = 'border-red-200';
      } else if (absentRec.type === '祝日') {
        bgColor = 'bg-pink-50 dark:bg-pink-900/30';
        textColor = 'text-pink-700 dark:text-pink-300';
        borderColor = 'border-pink-200';
      } else {
        bgColor = 'bg-blue-50 dark:bg-blue-900/30';
        textColor = 'text-blue-700 dark:text-blue-300';
        borderColor = 'border-blue-200';
      }
    } else if (isNationalHoliday) {
      statusLabel = '祝日';
      bgColor = 'bg-pink-50 dark:bg-pink-900/30';
      textColor = 'text-pink-700 dark:text-pink-300';
      borderColor = 'border-pink-200';
    } else if (isHoliday) {
      statusLabel = '定休日';
      bgColor = 'bg-slate-100 dark:bg-slate-700/50';
      textColor = 'text-slate-400';
    }

    const ariaLabel = `${month}月${d}日 ${WEEK_DAYS_JA[dayOfWeek]}曜日${statusLabel ? ` ${statusLabel}` : ' 通常出勤'}`;
    const isToday = isCurrentMonth && d === todayDate;

    cells.push(
      <button
        type="button"
        key={d}
        onClick={() => !disabled && onToggleDate(dateStr)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`h-20 rounded-xl ${bgColor} p-1.5 transition-all relative group overflow-hidden text-left ripple ${isToday ? 'ring-2 ring-brand-400 ring-offset-1 dark:ring-offset-slate-900' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 focus:ring-2 focus:ring-brand-300 focus:outline-none active:scale-95'}`}
      >
        <div className="flex justify-between items-start">
          <span
            className={`text-base font-black ${
              isToday
                ? 'bg-brand-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm'
                : dayOfWeek === 0
                  ? 'text-red-600 dark:text-red-400'
                  : dayOfWeek === 6
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {d}
          </span>
          {statusLabel && (
            <span className={`text-[9px] leading-none font-bold px-1 py-0.5 rounded ${textColor} bg-white/80 dark:bg-slate-900/60`}>
              {statusLabel}
            </span>
          )}
        </div>
        {/* ステータスバー */}
        {statusLabel && (
          <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl">
            <div className={`h-full rounded-b-xl ${
              statusLabel === '祝日週出勤' ? 'bg-amber-400'
              : statusLabel === '休日出勤' ? 'bg-orange-400'
              : statusLabel === '有給' ? 'bg-emerald-400'
              : statusLabel === '欠勤' ? 'bg-red-400'
              : statusLabel === '祝日' ? 'bg-pink-400'
              : statusLabel === '定休日' ? 'bg-slate-300 dark:bg-slate-600'
              : 'bg-blue-400'
            }`} />
          </div>
        )}
      </button>,
    );
  }

  return (
    <div className="mb-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="grid grid-cols-7 mb-2">
        {WEEK_LABELS.map((w, i) => (
          <div
            key={i}
            className={`text-center py-2 text-xs font-bold ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{cells}</div>
    </div>
  );
}

export default React.memo(CalendarView);
