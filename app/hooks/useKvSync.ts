'use client';

import { useState, useEffect, useRef } from 'react';
import type { DoctorItem, AbsentRecord, TimeChange } from '@/types';
import { apiHeaders, isValidKvData } from '@/lib/api';

interface UseKvSyncParams {
  selectedDoctor: DoctorItem | null;
  empId: string;
  year: number;
  month: number;
  isInitialized: boolean;
  extraWorkDays: string[];
  absentRecords: AbsentRecord[];
  timeChanges: TimeChange[];
  extraHolidays: string[];
  setExtraWorkDays: React.Dispatch<React.SetStateAction<string[]>>;
  setAbsentRecords: React.Dispatch<React.SetStateAction<AbsentRecord[]>>;
  setTimeChanges: React.Dispatch<React.SetStateAction<TimeChange[]>>;
  setExtraHolidays: React.Dispatch<React.SetStateAction<string[]>>;
}

interface UseKvSyncReturn {
  isKvLoading: boolean;
  kvError: string | null;
  clearKvError: () => void;
  canAutoSaveRef: React.MutableRefObject<boolean>;
}

export function useKvSync({
  selectedDoctor,
  empId,
  year,
  month,
  isInitialized,
  extraWorkDays,
  absentRecords,
  timeChanges,
  extraHolidays,
  setExtraWorkDays,
  setAbsentRecords,
  setTimeChanges,
  setExtraHolidays,
}: UseKvSyncParams): UseKvSyncReturn {
  const [isKvLoading, setIsKvLoading] = useState(false);
  const [kvError, setKvError] = useState<string | null>(null);
  const canAutoSaveRef = useRef(false);

  // ───────────────────────────────────────────────
  // KV からデータを読み込む
  // AbortController で年月を連続変更した際のレースコンディションを防止
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDoctor || !isInitialized) return;

    const controller = new AbortController();

    canAutoSaveRef.current = false;
    setIsKvLoading(true);
    setKvError(null);

    fetch(`/api/kintai?empId=${empId}&year=${year}&month=${month}`, {
      headers: apiHeaders(),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<unknown>;
      })
      .then((data) => {
        if (data !== null && isValidKvData(data)) {
          setExtraWorkDays(data.extraWorkDays);
          setAbsentRecords(data.absentRecords);
          setTimeChanges(data.timeChanges);
          setExtraHolidays(data.extraHolidays ?? []);
        } else if (data !== null) {
          console.warn('KVデータのスキーマが不正です。自動生成値を使用します。', data);
        }
        // data が null の場合は自動生成値をそのまま使う
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return; // 年月変更によるキャンセル
        // API 未接続環境（静的ホスティング等）では自動生成値を維持しエラーを表示
        const isNetworkError =
          err instanceof TypeError && err.message.includes('fetch');
        if (!isNetworkError) {
          setKvError('データの読み込みに失敗しました。ページを再読み込みしてください。');
        }
        console.warn('KV読み込みエラー:', err);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsKvLoading(false);
        setTimeout(() => {
          canAutoSaveRef.current = true;
        }, 0);
      });

    return () => controller.abort();
  }, [
    selectedDoctor,
    empId,
    year,
    month,
    isInitialized,
    setExtraWorkDays,
    setAbsentRecords,
    setTimeChanges,
  ]);

  // 例外データ変更時に KV へ自動保存（デバウンス 1 秒）
  useEffect(() => {
    if (!canAutoSaveRef.current || !selectedDoctor) return;

    const timer = setTimeout(() => {
      if (!canAutoSaveRef.current || !selectedDoctor) return;

      fetch('/api/kintai', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          empId,
          year,
          month,
          data: { extraWorkDays, absentRecords, timeChanges, extraHolidays },
        }),
      })
        .then((res) => {
          if (!res.ok) {
            setKvError('データの保存に失敗しました。ページを再読み込みしてください。');
            console.warn('KV保存HTTPエラー:', res.status);
          }
        })
        .catch((err) => {
          setKvError('データの保存に失敗しました。通信環境を確認してください。');
          console.warn('KV保存エラー:', err);
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [extraWorkDays, absentRecords, timeChanges, extraHolidays, selectedDoctor, empId, year, month]);

  const clearKvError = () => setKvError(null);

  return { isKvLoading, kvError, clearKvError, canAutoSaveRef };
}

// ── ドクター個別設定の KV 同期 ─────────────────────────────────────
interface UseConfigSyncParams {
  selectedDoctor: DoctorItem | null;
  empId: string;
  weekdayHoliday: number;
  isInitialized: boolean;
  setWeekdayHoliday: (wd: number) => void;
}

export function useConfigSync({
  selectedDoctor,
  empId,
  weekdayHoliday,
  isInitialized,
  setWeekdayHoliday,
}: UseConfigSyncParams): void {
  const configLoadedRef = useRef(false);

  // KV からドクター個別設定を読み込む
  useEffect(() => {
    if (!selectedDoctor || !isInitialized || !empId) return;

    configLoadedRef.current = false;

    fetch(`/api/config?empId=${empId}`, {
      headers: apiHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ weekdayHoliday?: number } | null>;
      })
      .then((data) => {
        if (data?.weekdayHoliday !== undefined) {
          setWeekdayHoliday(data.weekdayHoliday);
        }
      })
      .catch((err) => {
        console.warn('ドクター設定読み込みエラー:', err);
      })
      .finally(() => {
        setTimeout(() => {
          configLoadedRef.current = true;
        }, 0);
      });
  }, [selectedDoctor, empId, isInitialized, setWeekdayHoliday]);

  // ドクター個別設定を KV に保存（デバウンス 1 秒）
  useEffect(() => {
    if (!configLoadedRef.current || !selectedDoctor || !empId) return;

    const timer = setTimeout(() => {
      if (!configLoadedRef.current || !selectedDoctor) return;

      fetch('/api/config', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ empId, weekdayHoliday }),
      })
        .then((res) => {
          if (!res.ok) console.warn('ドクター設定保存HTTPエラー:', res.status);
        })
        .catch((err) => {
          console.warn('ドクター設定保存エラー:', err);
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [weekdayHoliday, selectedDoctor, empId]);
}
