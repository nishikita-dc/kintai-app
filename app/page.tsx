'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { AbsentRecord, TimeChange, PreviewRow, Summary } from '@/types';
import { JAPANESE_HOLIDAYS } from '@/lib/constants';
import BasicInfoStep from '@/app/components/BasicInfoStep';
import CalendarView from '@/app/components/CalendarView';
import ExceptionEditor from '@/app/components/ExceptionEditor';
import PreviewTable from '@/app/components/PreviewTable';

const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export default function Home() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3);
  const [empId, setEmpId] = useState('1030');
  const [empName, setEmpName] = useState('生野智也');
  const [weekdayHoliday, setWeekdayHoliday] = useState(4);
  const [enableSubstituteWork] = useState(true);

  const [extraWorkDays, setExtraWorkDays] = useState<string[]>([]);
  const [absentRecords, setAbsentRecords] = useState<AbsentRecord[]>([]);
  const [timeChanges, setTimeChanges] = useState<TimeChange[]>([]);

  const [generatedCsv, setGeneratedCsv] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [summary, setSummary] = useState<Summary>({
    workDays: 0,
    extraDays: 0,
    absentTotal: 0,
    absentPaid: 0,
    absentUnpaid: 0,
    absentSub: 0,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  const holidays = useMemo(
    () => [0, weekdayHoliday].sort((a, b) => a - b),
    [weekdayHoliday],
  );

  // ローカルストレージから設定を読み込む
  useEffect(() => {
    const savedConfig = localStorage.getItem('star_dental_config_v4_0');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setEmpId(parsed.empId || '1030');
        setEmpName(parsed.empName || '生野智也');
        if (parsed.weekdayHoliday !== undefined) {
          setWeekdayHoliday(parsed.weekdayHoliday);
        } else if (parsed.holidays) {
          const wd = (parsed.holidays as number[]).find((d) => d !== 0);
          setWeekdayHoliday(wd !== undefined ? wd : 4);
        }
        if (parsed.year && parsed.month) {
          setYear(parsed.year);
          setMonth(parsed.month);
        }
      } catch (e) {
        console.error('設定読み込みエラー', e);
      }
    }
    setIsInitialized(true);
  }, []);

  // 設定変更時にローカルストレージへ保存
  useEffect(() => {
    if (!isInitialized) return;
    const config = { empId, empName, weekdayHoliday, holidays: [0, weekdayHoliday], year, month };
    localStorage.setItem('star_dental_config_v4_0', JSON.stringify(config));
  }, [empId, empName, weekdayHoliday, year, month, isInitialized]);

  // 月・定休日変更時にスケジュールを自動生成
  useEffect(() => {
    if (!isInitialized) return;

    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const holidaysInMonth: AbsentRecord[] = Object.entries(JAPANESE_HOLIDAYS)
      .filter(([date]) => date.startsWith(prefix))
      .map(([date, name]) => ({ date, type: '祝日' as const, name }));

    const substituteWorkDays: string[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(year, month - 1, d);
      const dayOfWeek = currentDate.getDay();
      const dateDisplay = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      if (dayOfWeek === weekdayHoliday && !JAPANESE_HOLIDAYS[dateDisplay]) {
        const sun = new Date(currentDate);
        sun.setDate(currentDate.getDate() - dayOfWeek);

        let hasHolidayInWeek = false;
        for (let i = 0; i < 7; i++) {
          const check = new Date(sun);
          check.setDate(sun.getDate() + i);
          const k = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`;
          if (JAPANESE_HOLIDAYS[k]) {
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
    setPreviewData([]);
    setShowPreview(false);
  }, [year, month, weekdayHoliday, enableSubstituteWork, isInitialized]);

  const toggleDateStatus = useCallback(
    (dateStr: string) => {
      const dayOfWeek = new Date(dateStr).getDay();
      const isExtra = extraWorkDays.includes(dateStr);
      const absentRec = absentRecords.find((r) => r.date === dateStr);
      const isHoliday = holidays.includes(dayOfWeek);
      const isNationalHoliday = !!JAPANESE_HOLIDAYS[dateStr];
      const currentlyOff = !!absentRec || (!isExtra && (isHoliday || isNationalHoliday));

      if (currentlyOff) {
        if (absentRec) setAbsentRecords((prev) => prev.filter((r) => r.date !== dateStr));
        if ((isHoliday || isNationalHoliday) && !isExtra) {
          setExtraWorkDays((prev) => [...prev, dateStr].sort());
        }
      } else {
        if (isExtra) {
          setExtraWorkDays((prev) => prev.filter((d) => d !== dateStr));
        } else {
          setAbsentRecords((prev) =>
            [...prev, { date: dateStr, type: '有給' as const }].sort((a, b) =>
              a.date.localeCompare(b.date),
            ),
          );
        }
      }
    },
    [extraWorkDays, absentRecords, holidays],
  );

  const generateData = useCallback(() => {
    const previewRows: PreviewRow[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    let csvContent = '';
    csvContent += '#従業員コード*,名前*(従業員コード、名前はどちらか必須),打刻種別コード*,打刻日時*\r\n';
    csvContent += '#（注）*は必須項目です。最大登録数は1回あたり1000件です。,,,\r\n';
    csvContent +=
      '#先頭が#から始まる行は読み込まれません。最終行は改行で終了して下さい。また、下記サンプル行は削除してご使用下さい。,,,\r\n';
    csvContent += '#「打刻種別コード」出勤1、退勤2,,,\r\n';

    let countWork = 0;
    let countExtra = 0;
    let countAbsentPaid = 0;
    let countAbsentUnpaid = 0;
    let countAbsentSub = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(year, month - 1, d);
      const dayOfWeek = currentDate.getDay();
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dt = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}${m}${dt}`;
      const dateDisplay = `${year}-${m}-${dt}`;

      let isHoliday = holidays.includes(dayOfWeek);
      let status = '通常';
      let isExtraWork = false;
      let isSubstitute = false;

      const absentRec = absentRecords.find((r) => r.date === dateDisplay);
      if (absentRec) {
        isHoliday = true;
        if (absentRec.type === '祝日') {
          status = `祝日（${absentRec.name || JAPANESE_HOLIDAYS[dateDisplay] || ''}）`;
        } else {
          status = absentRec.type;
          if (!holidays.includes(dayOfWeek)) {
            if (absentRec.type === '有給') countAbsentPaid++;
            else if (absentRec.type === '欠勤') countAbsentUnpaid++;
            else if (absentRec.type === '振替休日') countAbsentSub++;
          }
        }
      }

      if (extraWorkDays.includes(dateDisplay)) {
        isHoliday = false;
        if (holidays.includes(dayOfWeek)) {
          if (dayOfWeek === weekdayHoliday) {
            status = '祝日振替診療';
            isSubstitute = true;
          } else {
            status = '休日出勤';
            isExtraWork = true;
          }
        } else if (absentRec?.type === '祝日') {
          status = '休日出勤';
          isExtraWork = true;
        }
      }

      if (!isHoliday) {
        countWork++;
        if (isExtraWork) countExtra++;

        let start = '0900';
        let end = dayOfWeek === 3 || dayOfWeek === 6 ? '1730' : '1930';

        const changeRec = timeChanges.find((c) => c.date === dateDisplay);
        if (changeRec) {
          start = changeRec.inTime.replace(':', '');
          end = changeRec.outTime.replace(':', '');
          if (status === '通常' || status === '祝日振替診療') status = '時間変更';
        }

        csvContent += `${empId},${empName},1,${dateStr}${start}\r\n`;
        csvContent += `${empId},${empName},2,${dateStr}${end}\r\n`;

        previewRows.push({
          date: `${Number(m)}/${Number(dt)}`,
          week: WEEK_DAYS[dayOfWeek],
          weekIdx: dayOfWeek,
          type: status,
          in: `${start.slice(0, 2)}:${start.slice(2)}`,
          out: `${end.slice(0, 2)}:${end.slice(2)}`,
          isSubstitute,
        });
      }
    }

    setGeneratedCsv(csvContent);
    setPreviewData(previewRows);
    setSummary({
      workDays: countWork,
      extraDays: countExtra,
      absentTotal: countAbsentPaid + countAbsentUnpaid + countAbsentSub,
      absentPaid: countAbsentPaid,
      absentUnpaid: countAbsentUnpaid,
      absentSub: countAbsentSub,
    });
    setShowPreview(true);
  }, [year, month, holidays, weekdayHoliday, extraWorkDays, absentRecords, timeChanges, empId, empName]);

  // プレビュー表示中は自動的に再生成
  useEffect(() => {
    if (showPreview) generateData();
  }, [generateData, showPreview]);

  const downloadCsv = async () => {
    if (!generatedCsv) return;
    const { default: Encoding } = await import('encoding-japanese');

    const unicodeList: number[] = Array.from({ length: generatedCsv.length }, (_, i) =>
      generatedCsv.charCodeAt(i),
    );
    const sjisCodeList = Encoding.convert(unicodeList, { to: 'SJIS', from: 'UNICODE' }) as number[];
    const blob = new Blob([new Uint8Array(sjisCodeList)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${year}${String(month).padStart(2, '0')}_${empId}_${empName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500 text-white w-10 h-10 rounded-lg flex items-center justify-center shadow-md">
              <i className="fa-solid fa-tooth text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">
                勤怠管理アプリ{' '}
                <span className="text-brand-500 text-xs bg-brand-50 px-1 rounded border border-brand-200 ml-1">
                  Ver 4.0
                </span>
              </h1>
              <p className="text-xs text-slate-500">スター歯科クリニック 西宮北口駅前院</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
              <i className="fa-solid fa-save mr-1" />
              Settings Auto-Saved
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6 mt-4">
        <BasicInfoStep
          year={year}
          month={month}
          empId={empId}
          empName={empName}
          weekdayHoliday={weekdayHoliday}
          onYearChange={setYear}
          onMonthChange={setMonth}
          onEmpIdChange={setEmpId}
          onEmpNameChange={setEmpName}
          onWeekdayHolidayChange={setWeekdayHoliday}
        />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition hover:shadow-md">
          <h2 className="text-lg font-bold mb-4 pb-2 text-slate-700 flex items-center border-b border-slate-200">
            <span className="bg-emerald-500 text-white text-xs font-bold mr-3 px-2 py-1 rounded-md">
              STEP 2
            </span>
            <i className="fa-solid fa-calendar-check mr-2 text-slate-500" />
            例外スケジュールの修正
          </h2>
          <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded">
            <i className="fa-solid fa-wand-magic-sparkles mr-1 text-brand-500" />
            カレンダーをクリックすると「出勤/休み」を切り替えられます。自動入力された祝日や振替出勤もここで変更できます。
          </p>

          <CalendarView
            year={year}
            month={month}
            holidays={holidays}
            weekdayHoliday={weekdayHoliday}
            extraWorkDays={extraWorkDays}
            absentRecords={absentRecords}
            onToggleDate={toggleDateStatus}
          />

          <ExceptionEditor
            extraWorkDays={extraWorkDays}
            absentRecords={absentRecords}
            timeChanges={timeChanges}
            setExtraWorkDays={setExtraWorkDays}
            setAbsentRecords={setAbsentRecords}
            setTimeChanges={setTimeChanges}
          />
        </div>

        <div className="flex justify-center pt-2">
          <button
            onClick={generateData}
            className="group bg-slate-800 hover:bg-slate-900 text-white w-full max-w-sm py-4 rounded-xl font-bold text-lg shadow-xl shadow-slate-200 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <span className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-white/30 transition">
              <i className="fa-solid fa-wand-magic-sparkles" />
            </span>
            データを作成・プレビュー
          </button>
        </div>

        {showPreview && (
          <PreviewTable
            previewData={previewData}
            summary={summary}
            generatedCsv={generatedCsv}
            year={year}
            month={month}
            empId={empId}
            empName={empName}
            onDownload={downloadCsv}
          />
        )}
      </main>

      <footer className="text-center p-6 text-slate-400 text-xs">
        &copy; 2026 Star Dental Clinic System.
      </footer>
    </div>
  );
}
