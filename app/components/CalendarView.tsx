'use client';

import type { AbsentRecord } from '@/types';
import { JAPANESE_HOLIDAYS } from '@/lib/constants';

interface CalendarViewProps {
  year: number;
  month: number;
  holidays: number[];
  weekdayHoliday: number;
  extraWorkDays: string[];
  absentRecords: AbsentRecord[];
  onToggleDate: (dateStr: string) => void;
  disabled?: boolean;
}

const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export default function CalendarView({
  year,
  month,
  holidays,
  weekdayHoliday,
  extraWorkDays,
  absentRecords,
  onToggleDate,
  disabled = false,
}: CalendarViewProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  const cells: React.ReactNode[] = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(
      <div key={`empty-${i}`} className="h-20 bg-slate-50 border border-slate-100" />,
    );
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();

    const isExtra = extraWorkDays.includes(dateStr);
    const absentRec = absentRecords.find((r) => r.date === dateStr);
    const isHoliday = holidays.includes(dayOfWeek);
    const isNationalHoliday = !!JAPANESE_HOLIDAYS[dateStr];

    let statusLabel = '';
    let bgColor = 'bg-white';
    let textColor = 'text-slate-700';
    let borderColor = 'border-slate-200';

    if (isExtra) {
      if (isNationalHoliday || isHoliday) {
        statusLabel = dayOfWeek === weekdayHoliday ? '振替出勤' : '休日出勤';
        bgColor = 'bg-orange-50';
        textColor = 'text-orange-700';
        borderColor = 'border-orange-200';
      }
    } else if (absentRec) {
      statusLabel = absentRec.type;
      if (absentRec.type === '有給') {
        bgColor = 'bg-emerald-50';
        textColor = 'text-emerald-700';
        borderColor = 'border-emerald-200';
      } else if (absentRec.type === '欠勤') {
        bgColor = 'bg-red-50';
        textColor = 'text-red-700';
        borderColor = 'border-red-200';
      } else if (absentRec.type === '祝日') {
        bgColor = 'bg-pink-50';
        textColor = 'text-pink-700';
        borderColor = 'border-pink-200';
      } else {
        bgColor = 'bg-blue-50';
        textColor = 'text-blue-700';
        borderColor = 'border-blue-200';
      }
    } else if (isNationalHoliday) {
      statusLabel = '祝日';
      bgColor = 'bg-pink-50';
      textColor = 'text-pink-700';
      borderColor = 'border-pink-200';
    } else if (isHoliday) {
      statusLabel = '定休日';
      bgColor = 'bg-slate-100';
      textColor = 'text-slate-400';
    }

    cells.push(
      <div
        key={d}
        onClick={() => !disabled && onToggleDate(dateStr)}
        className={`h-20 border ${borderColor} ${bgColor} p-1 transition relative group overflow-hidden ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:brightness-95'}`}
      >
        <div className="flex justify-between items-start">
          <span
            className={`text-sm font-bold ${
              dayOfWeek === 0
                ? 'text-red-500'
                : dayOfWeek === 6
                  ? 'text-blue-500'
                  : 'text-slate-600'
            }`}
          >
            {d}
          </span>
          {statusLabel && (
            <span className={`text-[9px] font-bold px-1 rounded ${textColor} bg-white/50`}>
              {statusLabel.slice(0, 4)}
            </span>
          )}
        </div>
        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <i className="fa-solid fa-pen text-slate-400 bg-white rounded-full p-1 shadow-sm text-xs" />
        </div>
      </div>,
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
      <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
        {WEEK_LABELS.map((w, i) => (
          <div
            key={i}
            className={`text-center py-2 text-xs font-bold ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600'
            }`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">{cells}</div>
    </div>
  );
}
