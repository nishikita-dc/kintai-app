'use client';

import { getJapaneseHolidays, WEEK_DAYS_JA } from '@/lib/constants';
import { useFocusTrap } from '@/app/hooks/useFocusTrap';

interface SettingsModalProps {
  weekdayHoliday: number;
  onWeekdayHolidayChange: (v: number) => void;
  empName: string;
  onDoctorChange: () => void;
  onClose: () => void;
}

const DAY_NAMES = WEEK_DAYS_JA.slice(1); // 月〜土（日は固定休のため除外）

export default function SettingsModal({
  weekdayHoliday,
  onWeekdayHolidayChange,
  empName,
  onDoctorChange,
  onClose,
}: SettingsModalProps) {
  const dialogRef = useFocusTrap(onClose);

  const currentYear = new Date().getFullYear();
  const yearHolidays = getJapaneseHolidays(currentYear);
  const allHolidaysList = Object.entries(yearHolidays)
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="個人設定"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <i className="fa-solid fa-gear text-brand-500" />
            個人設定
          </h3>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition"
          >
            <i className="fa-solid fa-xmark text-slate-400" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 定休日設定 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">
              <i className="fa-solid fa-calendar-xmark mr-2 text-slate-400" />
              定休日設定
            </label>
            <p className="text-xs text-slate-500 mb-3">
              日曜日 + もう1日の定休曜日を選択してください。変更は自動保存されます。
            </p>
            <div className="flex gap-2 flex-wrap">
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

          {/* 祝日データ確認 */}
          <details className="bg-white rounded-lg border border-slate-200 text-sm group">
            <summary className="px-3 py-2 text-xs text-slate-500 cursor-pointer hover:bg-slate-50 transition list-none flex justify-between items-center select-none">
              <span>
                <i className="fa-regular fa-calendar-days mr-2" />
                {currentYear}年の祝日データ確認
              </span>
              <i className="fa-solid fa-chevron-down text-slate-300 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-3 border-t border-slate-100 grid grid-cols-2 gap-2 bg-slate-50 max-h-40 overflow-y-auto">
              {allHolidaysList.map((h) => (
                <div key={h.date} className="text-xs flex items-center gap-1">
                  <span className="text-slate-400">{h.date.slice(5)}</span>
                  <span className="font-bold text-slate-600">{h.name}</span>
                </div>
              ))}
            </div>
          </details>

          {/* ドクター変更 */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => { onClose(); onDoctorChange(); }}
              className="w-full text-sm border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-arrows-rotate text-slate-400" />
              ドクターを変更する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
