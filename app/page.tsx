'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PreviewRow, Summary, DoctorItem } from '@/types';
import { JAPANESE_HOLIDAYS, DEFAULT_WORK_TIMES, WEEK_DAYS_JA, ADMIN_NAME } from '@/lib/constants';
import { buildKintaiCsv } from '@/lib/csvFormatter';
import type { CsvWorkRow } from '@/lib/csvFormatter';
import { apiHeaders } from '@/lib/api';
import { formatJST } from '@/lib/emailTemplate';
import { useAppStorage } from '@/app/hooks/useAppStorage';
import { useSchedule } from '@/app/hooks/useSchedule';
import { useKvSync, useConfigSync } from '@/app/hooks/useKvSync';
import CalendarView from '@/app/components/CalendarView';
import ExceptionEditor from '@/app/components/ExceptionEditor';
import PreviewTable from '@/app/components/PreviewTable';
import DoctorSelectScreen from '@/app/components/DoctorSelectScreen';
import SettingsModal from '@/app/components/SettingsModal';
import { useFocusTrap } from '@/app/hooks/useFocusTrap';


export default function Home() {
  // ── ストレージ・ドクター管理 ──────────────────────────────────────
  const {
    isInitialized,
    selectedDoctor,
    year,
    month,
    weekdayHoliday,
    setYear,
    setMonth,
    setWeekdayHoliday,
    selectDoctor,
    clearDoctor,
  } = useAppStorage();

  // selectedDoctor から派生させた値（二重管理を排除）
  const empId = selectedDoctor?.id ?? '';
  const empName = selectedDoctor?.name ?? '';

  // ── スケジュール管理 ──────────────────────────────────────────────
  const {
    holidays,
    extraWorkDays,
    setExtraWorkDays,
    absentRecords,
    setAbsentRecords,
    timeChanges,
    setTimeChanges,
    extraHolidays,
    setExtraHolidays,
    toggleDateStatus,
    resetSchedule,
    resetToDefault,
  } = useSchedule({
    year,
    month,
    weekdayHoliday,
    enableSubstituteWork: true,
    isInitialized,
  });

  // ── ドクター個別設定の KV 同期 ─────────────────────────────────────
  useConfigSync({
    selectedDoctor,
    empId,
    weekdayHoliday,
    isInitialized,
    setWeekdayHoliday,
  });

  // ── KV 同期 ───────────────────────────────────────────────────────
  const { isKvLoading, kvError, clearKvError, canAutoSaveRef } = useKvSync({
    selectedDoctor,
    empId,
    year,
    month,
    isInitialized,
    extraWorkDays,
    absentRecords,
    timeChanges,
    setExtraWorkDays,
    setAbsentRecords,
    setTimeChanges,
  });

  // ── プレビュー・CSV 状態 ──────────────────────────────────────────
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

  // ── 確定フロー状態 ────────────────────────────────────────────────
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  // ── 設定モーダル ──────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);

  // 月・定休日が変わったらプレビューをリセット
  useEffect(() => {
    if (!isInitialized) return;
    setPreviewData([]);
    setShowPreview(false);
  }, [year, month, weekdayHoliday, isInitialized]);

  // 年月・ドクターが変わったら確定ステータスを KV から復元
  useEffect(() => {
    if (!selectedDoctor || !isInitialized || !empId) {
      setIsConfirmed(false);
      setConfirmedAt(null);
      return;
    }

    const controller = new AbortController();
    setIsConfirmed(false);
    setConfirmedAt(null);

    fetch(`/api/confirm?empId=${empId}&year=${year}&month=${month}`, {
      headers: apiHeaders(),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ confirmed: boolean; confirmedAt: string; empName: string } | null>;
      })
      .then((data) => {
        if (data?.confirmed) {
          setIsConfirmed(true);
          setConfirmedAt(formatJST(data.confirmedAt));
        }
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        console.warn('確定ステータス読み込みエラー:', err);
      });

    return () => controller.abort();
  }, [selectedDoctor, empId, year, month, isInitialized]);

  // ── ドクター操作 ──────────────────────────────────────────────────
  const handleDoctorSelect = useCallback(
    (doctor: DoctorItem) => {
      canAutoSaveRef.current = false;
      selectDoctor(doctor);
    },
    [selectDoctor, canAutoSaveRef],
  );

  const handleDoctorChange = useCallback(() => {
    canAutoSaveRef.current = false;
    clearDoctor();
    resetSchedule();
    setPreviewData([]);
    setShowPreview(false);
  }, [clearDoctor, resetSchedule, canAutoSaveRef]);

  // ── データ生成 ────────────────────────────────────────────────────
  const generateData = useCallback(() => {
    const previewRows: PreviewRow[] = [];
    const csvRows: CsvWorkRow[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();

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

      let isHoliday = holidays.includes(dayOfWeek) || extraHolidays.includes(dateDisplay);
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
            status = '祝日週出勤';
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

        const defaults = DEFAULT_WORK_TIMES[dayOfWeek] ?? DEFAULT_WORK_TIMES[1];
        let start = defaults.inTime.replace(':', '');
        let end = defaults.outTime.replace(':', '');

        const changeRec = timeChanges.find((c) => c.date === dateDisplay);
        if (changeRec) {
          start = changeRec.inTime.replace(':', '');
          end = changeRec.outTime.replace(':', '');
          if (status === '通常' || status === '祝日週出勤') status = '時間変更';
        }

        csvRows.push({ dateStr, start, end });

        previewRows.push({
          date: `${Number(m)}/${Number(dt)}`,
          week: WEEK_DAYS_JA[dayOfWeek],
          weekIdx: dayOfWeek,
          type: status,
          in: `${start.slice(0, 2)}:${start.slice(2)}`,
          out: `${end.slice(0, 2)}:${end.slice(2)}`,
          isSubstitute,
        });
      }
    }

    setGeneratedCsv(buildKintaiCsv(empId, empName, csvRows));
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
  }, [year, month, holidays, weekdayHoliday, extraWorkDays, extraHolidays, absentRecords, timeChanges, empId, empName]);

  // プレビュー表示中は自動的に再生成
  useEffect(() => {
    if (showPreview) generateData();
  }, [generateData, showPreview]);

  // ── CSV ダウンロード ──────────────────────────────────────────────
  const downloadCsv = async () => {
    if (!generatedCsv) return;
    try {
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
    } catch (err) {
      console.error('CSVダウンロードエラー:', err);
      setConfirmError('CSVのダウンロードに失敗しました。ページを再読み込みしてください。');
    }
  };

  // ── 確定・取消 ────────────────────────────────────────────────────
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const confirmDialogRef = useFocusTrap(useCallback(() => setShowConfirmDialog(false), []));

  const handleConfirm = useCallback(async () => {
    setShowConfirmDialog(false);
    setIsConfirming(true);
    try {
      const res = await fetch('/api/confirm', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          empId,
          empName,
          year,
          month,
          csv: generatedCsv ?? '',
          summary: {
            workDays: summary.workDays,
            extraDays: summary.extraDays,
            absentPaid: summary.absentPaid,
            absentUnpaid: summary.absentUnpaid,
            absentSub: summary.absentSub,
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = (await res.json()) as { ok: boolean; confirmedAt: string };
      setIsConfirmed(true);
      setConfirmedAt(formatJST(result.confirmedAt));
    } catch (err) {
      console.error('確定エラー:', err);
      setConfirmError('確定処理に失敗しました。もう一度お試しください。');
    } finally {
      setIsConfirming(false);
    }
  }, [empId, empName, year, month, generatedCsv, summary]);

  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelConfirm = useCallback(async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    setConfirmError(null);
    try {
      const res = await fetch('/api/confirm', {
        method: 'DELETE',
        headers: apiHeaders(),
        body: JSON.stringify({ empId, year, month }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setIsConfirmed(false);
      setConfirmedAt(null);
      setGeneratedCsv(null);
      setShowPreview(false);
    } catch (err) {
      console.error('確定取消エラー:', err);
      setConfirmError('確定の取消に失敗しました。もう一度お試しください。');
    } finally {
      setIsCancelling(false);
    }
  }, [empId, year, month, isCancelling]);

  // ── 即時送信 ──────────────────────────────────────────────────────
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSendNow = useCallback(async () => {
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/send-monthly', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ year, month, empId }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; sent?: number };
      if (!res.ok) {
        setSendResult({ ok: false, message: data.error ?? `送信に失敗しました (HTTP ${res.status})` });
      } else {
        setSendResult({ ok: true, message: data.message ?? `${data.sent ?? 0}名分を送信しました` });
      }
    } catch (err) {
      setSendResult({ ok: false, message: '通信エラーが発生しました。ネットワークを確認してください。' });
    } finally {
      setIsSending(false);
    }
  }, [year, month, empId]);

  // 月が変わったら送信結果をリセット
  useEffect(() => {
    setSendResult(null);
  }, [year, month]);

  // ── ローディング・未選択ガード ────────────────────────────────────
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">
          <i className="fa-solid fa-spinner fa-spin mr-2" />
          読み込み中...
        </div>
      </div>
    );
  }

  if (!selectedDoctor) {
    return <DoctorSelectScreen onSelect={handleDoctorSelect} />;
  }

  // ── メイン UI ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-20 bg-slate-50 dark:bg-slate-900">
      <header className="bg-gradient-to-r from-brand-500 via-brand-400 to-amber-400 shadow-lg sticky top-0 z-20 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <img src="/logo.png" alt="スター歯科クリニック" className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white leading-tight whitespace-nowrap">
                勤怠管理アプリ
              </h1>
              <p className="text-[10px] text-white/70 whitespace-nowrap">医療法人社団 スター歯科クリニック</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-white whitespace-nowrap">
                {empName}先生
              </p>
              <p className="text-[10px] text-white/60 font-mono">ID: {empId}</p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 font-bold backdrop-blur-sm"
              aria-label="設定"
            >
              <i className="fa-solid fa-gear" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6 mt-4">
        {/* KV エラーバナー */}
        {kvError && (
          <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-red-700">
              <i className="fa-solid fa-circle-exclamation mr-2" />
              {kvError}
            </span>
            <button
              onClick={clearKvError}
              className="text-red-400 hover:text-red-600 transition flex-shrink-0"
              aria-label="エラーを閉じる"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {/* 確定エラーバナー */}
        {confirmError && (
          <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-red-700">
              <i className="fa-solid fa-circle-exclamation mr-2" />
              {confirmError}
            </span>
            <button
              onClick={() => setConfirmError(null)}
              className="text-red-400 hover:text-red-600 transition flex-shrink-0"
              aria-label="エラーを閉じる"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {/* 月末リマインドバナー: 当月25日以降 & 未確定の場合のみ表示 */}
        {(() => {
          const now = new Date();
          const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
          const day = now.getDate();
          const lastDay = new Date(year, month, 0).getDate();
          const daysLeft = lastDay - day;
          if (isCurrentMonth && day >= 25 && !isConfirmed) {
            return (
              <div className="bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-400 dark:border-orange-600 rounded-xl px-4 py-4 flex items-start gap-3 animate-pulse-slow">
                <div className="flex-shrink-0 w-10 h-10 bg-orange-100 dark:bg-orange-800/50 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-bell text-orange-500 text-lg" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
                    {daysLeft === 0
                      ? '本日が月末です！確定してください'
                      : `あと${daysLeft}日で自動送信されます`}
                  </p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    {month}月{lastDay}日 20:00 に{ADMIN_NAME}へ送信されます。
                    まだ確定されていません。内容を確認して「確定して送信予約する」を押してください。
                  </p>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* 対象月バナー */}
        <div className="glass rounded-xl shadow-sm border border-white/50 dark:border-slate-700 p-5">
          <div className="flex items-center justify-center gap-4 mb-2">
            <button
              onClick={() => {
                if (month === 1) { setYear(year - 1); setMonth(12); }
                else setMonth(month - 1);
              }}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition text-slate-600 dark:text-slate-300"
              aria-label="前月"
            >
              <i className="fa-solid fa-chevron-left text-sm" aria-hidden="true" />
            </button>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {year}年<span className="text-brand-500">{month}月</span>分
            </p>
            <button
              onClick={() => {
                if (month === 12) { setYear(year + 1); setMonth(1); }
                else setMonth(month + 1);
              }}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition text-slate-600 dark:text-slate-300"
              aria-label="翌月"
            >
              <i className="fa-solid fa-chevron-right text-sm" aria-hidden="true" />
            </button>
          </div>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            定休日: 日 + {WEEK_DAYS_JA[weekdayHoliday]}
          </p>
        </div>

        <div id="section-calendar" className="glass rounded-xl shadow-sm border border-white/50 dark:border-slate-700 p-6 transition hover:shadow-md scroll-mt-20">
          <h2 className="text-lg font-bold mb-4 pb-2 text-slate-800 dark:text-slate-100 flex items-center border-b border-slate-200 dark:border-slate-700">
            <i className="fa-solid fa-calendar-check mr-2 text-brand-500" />
            例外スケジュールの修正
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
            <i className="fa-solid fa-wand-magic-sparkles mr-1 text-brand-500" />
            カレンダーをクリックすると「出勤/休み」を切り替えられます。自動入力された祝日や振替出勤もここで変更できます。
          </p>

          {/* KV 読み込み中オーバーレイ */}
          <div className="relative">
            {isKvLoading && (
              <div className="absolute inset-0 z-10 rounded-lg p-2 space-y-4">
                {/* カレンダースケルトン */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={`wh-${i}`} className="skeleton h-6" />
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={`sh-${i}`} className="skeleton h-20 rounded-xl" />
                  ))}
                </div>
                {/* リストスケルトン */}
                <div className="space-y-2">
                  <div className="skeleton h-8 w-40" />
                  <div className="skeleton h-12" />
                  <div className="skeleton h-12" />
                </div>
              </div>
            )}

            {isConfirmed && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
                <i className="fa-solid fa-lock text-green-500" />
                <span className="text-sm text-green-700 font-bold">
                  確定済みのため編集できません。編集するには確定を取り消してください。
                </span>
              </div>
            )}

            <CalendarView
              year={year}
              month={month}
              holidays={holidays}
              weekdayHoliday={weekdayHoliday}
              extraWorkDays={extraWorkDays}
              extraHolidays={extraHolidays}
              absentRecords={absentRecords}
              onToggleDate={toggleDateStatus}
              disabled={isConfirmed || isConfirming}
              onSwipePrev={() => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); }}
              onSwipeNext={() => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); }}
            />

            <ExceptionEditor
              year={year}
              month={month}
              weekdayHoliday={weekdayHoliday}
              holidays={holidays}
              extraWorkDays={extraWorkDays}
              absentRecords={absentRecords}
              timeChanges={timeChanges}
              setExtraWorkDays={setExtraWorkDays}
              setAbsentRecords={setAbsentRecords}
              setTimeChanges={setTimeChanges}
              disabled={isConfirmed || isConfirming}
            />
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <button
            onClick={generateData}
            className="group bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white w-full max-w-sm py-4 rounded-xl font-bold text-lg shadow-xl shadow-brand-200 dark:shadow-brand-900/30 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <span className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-white/30 transition">
              <i className="fa-solid fa-wand-magic-sparkles" />
            </span>
            データを作成・プレビュー
          </button>
        </div>

        {showPreview && (
          <div id="section-preview" className="scroll-mt-20" />
        )}
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
            onConfirm={() => setShowConfirmDialog(true)}
            isConfirming={isConfirming}
            isConfirmed={isConfirmed}
            confirmedAt={confirmedAt ?? undefined}
            onCancelConfirm={handleCancelConfirm}
            onSendNow={handleSendNow}
            isSending={isSending}
            sendResult={sendResult}
          />
        )}
      </main>

      <footer className="text-center p-6 pb-24 text-slate-400 dark:text-slate-500 text-xs">
        &copy; {new Date().getFullYear()} Star Dental Clinic System.
      </footer>

      {/* ボトムナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 glass border-t border-white/30 dark:border-slate-700 shadow-lg sm:hidden">
        <div className="max-w-3xl mx-auto flex justify-around py-2">
          <button
            onClick={() => document.getElementById('section-calendar')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-brand-600 dark:text-brand-400"
          >
            <i className="fa-solid fa-calendar text-lg" />
            <span className="text-[10px] font-bold">カレンダー</span>
          </button>
          <button
            onClick={() => {
              if (!showPreview) generateData();
              setTimeout(() => document.getElementById('section-preview')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-500 dark:text-slate-400"
          >
            <i className="fa-solid fa-table-list text-lg" />
            <span className="text-[10px] font-bold">プレビュー</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-500 dark:text-slate-400"
          >
            <i className="fa-solid fa-gear text-lg" />
            <span className="text-[10px] font-bold">設定</span>
          </button>
        </div>
      </nav>

      {/* 設定モーダル */}
      {showSettings && (
        <SettingsModal
          weekdayHoliday={weekdayHoliday}
          onWeekdayHolidayChange={setWeekdayHoliday}
          empName={empName}
          year={year}
          month={month}
          extraHolidays={extraHolidays}
          onExtraHolidaysChange={setExtraHolidays}
          onReset={resetToDefault}
          onDoctorChange={handleDoctorChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* 確定確認ダイアログ */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmDialog(false); }}
        >
          <div ref={confirmDialogRef} role="dialog" aria-modal="true" aria-label="確定確認" className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700 animation-scale-in">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-brand-50 rounded-full flex items-center justify-center border-4 border-brand-100">
                <i className="fa-solid fa-paper-plane text-brand-500 text-xl" />
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-center text-lg mb-2">
              勤怠データを確定しますか？
            </h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              {year}年{month}月の勤怠データを確定します。<br />
              {month}月{new Date(year, month, 0).getDate()}日 20:00 に{ADMIN_NAME}へ自動送信されます。<br />
              よろしいですか？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-3 font-bold text-sm hover:bg-slate-50 transition"
              >
                戻る
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-3 font-bold text-sm shadow-md transition flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-check" />
                確定する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
