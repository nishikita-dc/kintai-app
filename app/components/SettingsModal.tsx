'use client';

import { useState } from 'react';
import { getJapaneseHolidays, WEEK_DAYS_JA } from '@/lib/constants';
import { useFocusTrap } from '@/app/hooks/useFocusTrap';

interface SettingsModalProps {
  weekdayHoliday: number;
  onWeekdayHolidayChange: (v: number) => void;
  empName: string;
  year: number;
  month: number;
  extraHolidays: string[];
  onExtraHolidaysChange: (days: string[]) => void;
  onReset: () => void;
  onDoctorChange: () => void;
  onClose: () => void;
}

const DAY_NAMES = WEEK_DAYS_JA.slice(1);

function getWeekDay(dateStr: string) {
  return WEEK_DAYS_JA[new Date(dateStr).getDay()];
}

export default function SettingsModal({
  weekdayHoliday,
  onWeekdayHolidayChange,
  empName,
  year,
  month,
  extraHolidays,
  onExtraHolidaysChange,
  onReset,
  onDoctorChange,
  onClose,
}: SettingsModalProps) {
  const dialogRef = useFocusTrap(onClose);

  const currentYear = new Date().getFullYear();
  const yearHolidays = getJapaneseHolidays(currentYear);
  const allHolidaysList = Object.entries(yearHolidays)
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const [tempExtraHoliday, setTempExtraHoliday] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const addExtraHoliday = () => {
    if (!tempExtraHoliday) return;
    if (!tempExtraHoliday.startsWith(monthPrefix)) return;
    if (extraHolidays.includes(tempExtraHoliday)) return;
    onExtraHolidaysChange([...extraHolidays, tempExtraHoliday].sort());
    setTempExtraHoliday('');
  };

  const removeExtraHoliday = (date: string) => {
    onExtraHolidaysChange(extraHolidays.filter((d) => d !== date));
  };

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
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden animation-scale-in max-h-[90vh] overflow-y-auto"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-600 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
            <i className="fa-solid fa-gear text-brand-500" />
            個人設定
          </h3>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition"
          >
            <i className="fa-solid fa-xmark text-slate-400" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 定休日設定 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
              <i className="fa-solid fa-calendar-xmark mr-2 text-slate-400" />
              定休日設定
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              日曜日 + もう1日の定休曜日を選択してください。変更は自動保存されます。
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                disabled
                className="w-10 h-10 rounded-full text-sm font-bold bg-slate-700 dark:bg-slate-500 text-white shadow-lg cursor-not-allowed opacity-80"
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
                        : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-slate-400'
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

          {/* 追加定休日（臨時休診） */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
              <i className="fa-solid fa-calendar-minus mr-2 text-violet-500" />
              今月の追加定休日
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              研修・臨時休診など、イレギュラーな休みを日付で追加できます。
            </p>

            {/* 追加フォーム */}
            <div className="flex gap-2 mb-3">
              <input
                type="date"
                value={tempExtraHoliday}
                min={`${monthPrefix}-01`}
                max={`${monthPrefix}-${new Date(year, month, 0).getDate()}`}
                onChange={(e) => setTempExtraHoliday(e.target.value)}
                className="flex-1 rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 p-2 text-sm border outline-none"
              />
              <button
                onClick={addExtraHoliday}
                disabled={!tempExtraHoliday || !tempExtraHoliday.startsWith(monthPrefix)}
                className="bg-violet-500 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition"
              >
                追加
              </button>
            </div>

            {/* 追加定休日リスト */}
            <div className="space-y-1.5">
              {extraHolidays.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">追加定休日なし</p>
              )}
              {extraHolidays.map((d) => (
                <div
                  key={d}
                  className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-bold text-violet-800 dark:text-violet-300">
                    {d.slice(5)} <span className="text-violet-500">({getWeekDay(d)})</span>
                    <span className="text-violet-400 font-normal ml-2 text-xs">臨時休診</span>
                  </span>
                  <button
                    onClick={() => removeExtraHoliday(d)}
                    className="text-violet-400 hover:text-red-500 p-1 transition"
                    aria-label="削除"
                  >
                    <i className="fa-solid fa-trash-can text-xs" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 当月データのリセット */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-600">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
              <i className="fa-solid fa-rotate-left mr-2 text-red-400" />
              当月データのリセット
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {year}年{month}月分の編集内容をすべて初期状態に戻します。祝日・振替出勤が自動生成し直されます。
            </p>
            {showResetConfirm ? (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-red-700 dark:text-red-300">
                  {year}年{month}月分のデータをリセットしますか？
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  有給・休日出勤・時間変更・追加定休日がすべて消えます。元に戻せません。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 text-sm border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 rounded-lg py-2 font-bold transition hover:bg-slate-50"
                  >
                    やめる
                  </button>
                  <button
                    onClick={() => {
                      onReset();
                      setShowResetConfirm(false);
                    }}
                    className="flex-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 font-bold transition"
                  >
                    リセットする
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-sm border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 bg-white dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 w-full"
              >
                <i className="fa-solid fa-rotate-left" />
                {year}年{month}月分をリセットする
              </button>
            )}
          </div>

          {/* 祝日データ確認 */}
          <details className="bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 text-sm group">
            <summary className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition list-none flex justify-between items-center select-none">
              <span>
                <i className="fa-regular fa-calendar-days mr-2" />
                {currentYear}年の祝日データ確認
              </span>
              <i className="fa-solid fa-chevron-down text-slate-300 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="p-3 border-t border-slate-100 dark:border-slate-600 grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-700/50 max-h-40 overflow-y-auto">
              {allHolidaysList.map((h) => (
                <div key={h.date} className="text-xs flex items-center gap-1">
                  <span className="text-slate-400">{h.date.slice(5)}</span>
                  <span className="font-bold text-slate-600 dark:text-slate-300">{h.name}</span>
                </div>
              ))}
            </div>
          </details>

          {/* ドクター変更 */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-600">
            <button
              onClick={() => { onClose(); onDoctorChange(); }}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
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
