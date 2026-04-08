'use client';

import { JAPANESE_HOLIDAYS } from '@/lib/constants';

interface BasicInfoStepProps {
  year: number;
  month: number;
  weekdayHoliday: number;
  onYearChange: (v: number) => void;
  onMonthChange: (v: number) => void;
  onWeekdayHolidayChange: (v: number) => void;
}

const DAY_NAMES = ['月', '火', '水', '木', '金', '土'] as const;

export default function BasicInfoStep({
  year,
  month,
  weekdayHoliday,
  onYearChange,
  onMonthChange,
  onWeekdayHolidayChange,
}: BasicInfoStepProps) {
  const allHolidaysList = Object.entries(JAPANESE_HOLIDAYS)
    .filter(([date]) => date.startsWith(`${year}-`))
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition hover:shadow-md">
      <h2 className="text-lg font-bold mb-4 pb-2 text-slate-700 flex items-center border-b border-slate-200">
        <span className="bg-brand-500 text-white text-xs font-bold mr-3 px-2 py-1 rounded-md">
          STEP 1
        </span>
        <i className="fa-solid fa-user-gear mr-2 text-slate-500" />
        基本情報設定
      </h2>

      {/* 年月選択 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">対象年</label>
          <input
            type="number"
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="w-full rounded-lg border-slate-300 focus:border-brand-500 focus:ring-brand-500 shadow-sm p-2.5 bg-slate-50 border font-bold text-center"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">対象月</label>
          <input
            type="number"
            value={month}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="w-full rounded-lg border-slate-300 focus:border-brand-500 focus:ring-brand-500 shadow-sm p-2.5 bg-slate-50 border font-bold text-center"
          />
        </div>
      </div>

      {/* 定休日設定 */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div className="flex justify-between items-end mb-3">
          <label className="block text-xs font-bold text-slate-500">
            定休日設定 (日曜日 + 任意の曜日)
          </label>
          <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
            ※変更は自動保存されます
          </span>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          <button
            disabled
            className="w-10 h-10 rounded-full text-sm font-bold bg-slate-700 text-white shadow-lg cursor-not-allowed opacity-80"
          >
            日
          </button>
          {DAY_NAMES.map((day, idx) => {
            const dayIdx = idx + 1;
            return (
              <button
                key={dayIdx}
                onClick={() => onWeekdayHolidayChange(dayIdx)}
                className={`w-10 h-10 rounded-full text-sm font-bold transition-all duration-200 ${
                  weekdayHoliday === dayIdx
                    ? 'bg-brand-600 text-white shadow-lg scale-105'
                    : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-400'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          ※選択した曜日に、祝日週の振替診療が自動設定されます。
        </p>
      </div>

      {/* 祝日データ確認アコーディオン */}
      <div className="mt-4">
        <details className="bg-white rounded border border-slate-200 text-sm group">
          <summary className="px-3 py-2 text-xs text-slate-500 cursor-pointer hover:bg-slate-50 transition list-none flex justify-between items-center select-none">
            <span>
              <i className="fa-regular fa-calendar-days mr-2" />
              {year}年の祝日データ確認
            </span>
            <i className="fa-solid fa-chevron-down text-slate-300 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="p-3 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 max-h-40 overflow-y-auto">
            {allHolidaysList.map((h) => (
              <div key={h.date} className="text-xs flex items-center gap-1">
                <span className="text-slate-400">{h.date.slice(5)}</span>
                <span className="font-bold text-slate-600">{h.name}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
