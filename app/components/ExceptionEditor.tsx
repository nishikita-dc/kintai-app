'use client';

import { useState } from 'react';
import type { AbsentRecord, TimeChange } from '@/types';
import { WEEK_DAYS_JA, USER_ABSENT_TYPES } from '@/lib/constants';
import type { UserAbsentType } from '@/lib/constants';

interface ExceptionEditorProps {
  year: number;
  month: number;
  weekdayHoliday: number;
  holidays: number[];
  extraWorkDays: string[];
  absentRecords: AbsentRecord[];
  timeChanges: TimeChange[];
  setExtraWorkDays: React.Dispatch<React.SetStateAction<string[]>>;
  setAbsentRecords: React.Dispatch<React.SetStateAction<AbsentRecord[]>>;
  setTimeChanges: React.Dispatch<React.SetStateAction<TimeChange[]>>;
  disabled?: boolean;
}

function getWeekDay(dateStr: string) {
  return WEEK_DAYS_JA[new Date(dateStr).getDay()];
}

export default function ExceptionEditor({
  year,
  month,
  weekdayHoliday,
  holidays,
  extraWorkDays,
  absentRecords,
  timeChanges,
  setExtraWorkDays,
  setAbsentRecords,
  setTimeChanges,
  disabled = false,
}: ExceptionEditorProps) {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  function isInTargetMonth(dateStr: string): boolean {
    return dateStr.startsWith(monthPrefix);
  }
  const [tempExtraDate, setTempExtraDate] = useState('');
  const [tempAbsentDate, setTempAbsentDate] = useState('');
  const [tempAbsentType, setTempAbsentType] = useState<UserAbsentType>('有給');
  const [tempChangeDate, setTempChangeDate] = useState('');
  const [tempInTime, setTempInTime] = useState('');
  const [tempOutTime, setTempOutTime] = useState('');

  const [extraError, setExtraError] = useState<string | null>(null);
  const [absentError, setAbsentError] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);

  const addExtraWork = () => {
    if (!tempExtraDate) {
      setExtraError('日付を選択してください');
      return;
    }
    if (!isInTargetMonth(tempExtraDate)) {
      setExtraError(`${year}年${month}月の日付を選択してください`);
      return;
    }
    if (extraWorkDays.includes(tempExtraDate)) {
      setExtraError('すでに登録済みの日付です');
      return;
    }
    setExtraError(null);
    setExtraWorkDays((prev) => [...prev, tempExtraDate].sort());
    setTempExtraDate('');
  };

  const addAbsentRecord = () => {
    if (!tempAbsentDate) {
      setAbsentError('日付を選択してください');
      return;
    }
    if (!isInTargetMonth(tempAbsentDate)) {
      setAbsentError(`${year}年${month}月の日付を選択してください`);
      return;
    }
    setAbsentError(null);
    setAbsentRecords((prev) =>
      [...prev.filter((r) => r.date !== tempAbsentDate), { date: tempAbsentDate, type: tempAbsentType }].sort(
        (a, b) => a.date.localeCompare(b.date),
      ),
    );
    setTempAbsentDate('');
  };

  const addChange = () => {
    if (!tempChangeDate || !tempInTime || !tempOutTime) {
      setChangeError('日付・開始・終了をすべて入力してください');
      return;
    }
    if (!isInTargetMonth(tempChangeDate)) {
      setChangeError(`${year}年${month}月の日付を選択してください`);
      return;
    }
    if (tempInTime >= tempOutTime) {
      setChangeError('開始時刻は終了時刻より前にしてください');
      return;
    }
    setChangeError(null);
    setTimeChanges((prev) =>
      [...prev.filter((c) => c.date !== tempChangeDate), { date: tempChangeDate, inTime: tempInTime, outTime: tempOutTime }].sort(
        (a, b) => a.date.localeCompare(b.date),
      ),
    );
    setTempChangeDate('');
    setTempInTime('');
    setTempOutTime('');
  };

  return (
    <div className={`grid md:grid-cols-2 gap-8 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* 左カラム：お休み・休日出勤 */}
      <div className="space-y-6">
        {/* お休み登録 */}
        <div>
          <label className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
            <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mr-2">
              <i className="fa-solid fa-umbrella-beach" />
            </span>
            お休みリスト（祝日・有給・欠勤）
          </label>

          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600 mb-3">
            <div className="mb-2">
              <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">日付</span>
              <input
                type="date"
                value={tempAbsentDate}
                onChange={(e) => { setTempAbsentDate(e.target.value); setAbsentError(null); }}
                className="w-full rounded border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 p-1.5 text-sm border outline-none"
              />
            </div>
            <div className="mb-3">
              <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">休みの種類</span>
              <div className="flex gap-2">
                {USER_ABSENT_TYPES.map((type) => (
                  <label
                    key={type}
                    className={`flex-1 text-center py-1.5 rounded text-xs cursor-pointer border select-none transition ${
                      tempAbsentType === type
                        ? type === '有給'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : type === '欠勤'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="absentType"
                      value={type}
                      checked={tempAbsentType === type}
                      onChange={() => setTempAbsentType(type as UserAbsentType)}
                      className="sr-only"
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
            {absentError && (
              <p className="text-xs text-red-500 mb-2">
                <i className="fa-solid fa-circle-exclamation mr-1" />
                {absentError}
              </p>
            )}
            <button
              onClick={addAbsentRecord}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm transition"
            >
              リストに追加
            </button>
          </div>

          <div className="flex flex-col gap-2 min-h-[2rem]">
            {absentRecords.length === 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500">登録なし</span>
            )}
            {absentRecords.map((r) => (
              <div
                key={r.date}
                className="flex justify-between items-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs px-2 py-1.5 rounded shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {r.date.slice(5)}{' '}
                    <span className="text-slate-400">({getWeekDay(r.date)})</span>
                  </span>
                  {r.type === '祝日' && (
                    <span className="text-xs text-slate-400">({r.name})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] text-white font-bold ${
                      r.type === '有給'
                        ? 'bg-emerald-400'
                        : r.type === '欠勤'
                          ? 'bg-red-400'
                          : r.type === '祝日'
                            ? 'bg-pink-400'
                            : 'bg-blue-400'
                    }`}
                  >
                    {r.type}
                  </span>
                  <button
                    onClick={() =>
                      setAbsentRecords((prev) => prev.filter((x) => x.date !== r.date))
                    }
                    className="text-slate-400 hover:text-red-500 p-2 -mr-1 flex items-center justify-center"
                    aria-label="削除"
                  >
                    <i className="fa-solid fa-trash-can" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 休日出勤 */}
        <div className="pt-4 border-t border-slate-100">
          <label className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
            <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mr-2">
              <i className="fa-solid fa-briefcase" />
            </span>
            休日出勤リスト（振替診療含む）
          </label>
          <div className="flex gap-2 mb-1">
            <input
              type="date"
              value={tempExtraDate}
              onChange={(e) => { setTempExtraDate(e.target.value); setExtraError(null); }}
              className="flex-1 rounded-lg border-slate-300 p-2 text-sm border focus:ring-2 focus:ring-orange-200 outline-none"
            />
            <button
              onClick={addExtraWork}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition"
            >
              追加
            </button>
          </div>
          {extraError && (
            <p className="text-xs text-red-500 mb-2">
              <i className="fa-solid fa-circle-exclamation mr-1" />
              {extraError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {extraWorkDays.length === 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500">登録なし</span>
            )}
            {extraWorkDays.map((d) => {
              const dow = new Date(d).getDay();
              const isHolidayWeekWork = dow === weekdayHoliday;
              const label = isHolidayWeekWork ? '祝日週出勤' : '休日出勤';
              const borderCls = isHolidayWeekWork ? 'border-amber-200 dark:border-amber-800' : 'border-orange-200 dark:border-orange-800';
              const textCls = isHolidayWeekWork ? 'text-amber-800 dark:text-amber-300' : 'text-orange-800 dark:text-orange-300';
              const badgeCls = isHolidayWeekWork ? 'text-amber-500' : 'text-orange-500';
              return (
              <div
                key={d}
                className={`flex justify-between items-center bg-white dark:bg-slate-700 border ${borderCls} text-xs px-2 py-1.5 rounded shadow-sm`}
              >
                <span className={`font-bold ${textCls}`}>
                  {d.slice(5)} <span className={badgeCls}>({getWeekDay(d)})</span>{' '}
                  <span className={`${badgeCls} font-normal ml-1`}>({label})</span>
                </span>
                <button
                  onClick={() => setExtraWorkDays((prev) => prev.filter((x) => x !== d))}
                  className="text-slate-400 hover:text-red-500"
                >
                  <i className="fa-solid fa-trash-can" />
                </button>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 右カラム：時間変更 */}
      <div className="border-t md:border-t-0 md:border-l border-slate-100 md:pl-8 pt-6 md:pt-0">
        <label className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
          <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-2">
            <i className="fa-solid fa-clock" />
          </span>
          時間変更
          <span className="ml-2 text-xs font-normal text-slate-500">遅刻・早退・残業など</span>
        </label>

        <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600 mb-3">
          <div className="mb-2">
            <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">日付</span>
            <input
              type="date"
              value={tempChangeDate}
              onChange={(e) => { setTempChangeDate(e.target.value); setChangeError(null); }}
              className="w-full rounded border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 p-1.5 text-sm border outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">開始</span>
              <input
                type="time"
                value={tempInTime}
                onChange={(e) => { setTempInTime(e.target.value); setChangeError(null); }}
                className={`w-full rounded p-1.5 text-sm border outline-none ${
                  changeError && tempInTime && tempOutTime && tempInTime >= tempOutTime
                    ? 'border-red-400 bg-red-50'
                    : 'border-slate-300'
                }`}
              />
            </div>
            <span className="text-slate-400 pb-2">~</span>
            <div className="flex-1">
              <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">終了</span>
              <input
                type="time"
                value={tempOutTime}
                onChange={(e) => { setTempOutTime(e.target.value); setChangeError(null); }}
                className={`w-full rounded p-1.5 text-sm border outline-none ${
                  changeError && tempInTime && tempOutTime && tempInTime >= tempOutTime
                    ? 'border-red-400 bg-red-50'
                    : 'border-slate-300'
                }`}
              />
            </div>
          </div>
          {changeError && (
            <p className="text-xs text-red-500 mt-2">
              <i className="fa-solid fa-circle-exclamation mr-1" />
              {changeError}
            </p>
          )}
          <button
            onClick={addChange}
            className="w-full mt-3 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm transition"
          >
            リストに追加
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
          {timeChanges.length === 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500">登録なし</span>
          )}
          {timeChanges.map((c) => (
            <div
              key={c.date}
              className="bg-white dark:bg-slate-700 border border-purple-100 dark:border-purple-800 text-purple-800 dark:text-purple-300 text-xs p-2 rounded flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold bg-purple-100 px-1.5 rounded">{c.date.slice(5)}</span>
                <span>
                  {c.inTime} - {c.outTime}
                </span>
              </div>
              <button
                onClick={() => setTimeChanges((prev) => prev.filter((x) => x.date !== c.date))}
                className="text-slate-400 hover:text-red-500 p-2 flex items-center justify-center"
                aria-label="削除"
              >
                <i className="fa-solid fa-trash-can" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
