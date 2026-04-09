'use client';

import { useState, useEffect } from 'react';
import type { DoctorItem } from '@/types';
import { STORAGE_KEYS, weekdayKey } from '@/lib/storageKeys';

interface UseAppStorageReturn {
  isInitialized: boolean;
  selectedDoctor: DoctorItem | null;
  year: number;
  month: number;
  weekdayHoliday: number;
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
  setWeekdayHoliday: (wd: number) => void;
  selectDoctor: (doctor: DoctorItem) => void;
  clearDoctor: () => void;
}

export function useAppStorage(): UseAppStorageReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorItem | null>(null);

  // 年月は現在日付から自動設定
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [weekdayHoliday, setWeekdayHoliday] = useState(4);

  // localStorage から初期値を復元
  useEffect(() => {
    let docId: string | null = null;

    const savedDoctor = localStorage.getItem(STORAGE_KEYS.SELECTED_DOCTOR);
    if (savedDoctor) {
      try {
        const doc = JSON.parse(savedDoctor) as DoctorItem;
        setSelectedDoctor(doc);
        docId = doc.id;
      } catch (e) {
        console.error('ドクター読み込みエラー', e);
      }
    }

    // 年月は常に現在日付を使用（自動切替）

    // 定休日はドクター個別設定を優先し、なければ共通設定にフォールバック
    const doctorConfigRaw = docId ? localStorage.getItem(weekdayKey(docId)) : null;
    if (doctorConfigRaw !== null) {
      const wd = Number(doctorConfigRaw);
      if (!isNaN(wd)) setWeekdayHoliday(wd);
    } else {
      const savedConfig =
        localStorage.getItem(STORAGE_KEYS.CONFIG) ??
        localStorage.getItem('star_dental_config_v4_0');
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          if (parsed.weekdayHoliday !== undefined) {
            setWeekdayHoliday(parsed.weekdayHoliday);
          } else if (parsed.holidays) {
            const wd = (parsed.holidays as number[]).find((d: number) => d !== 0);
            setWeekdayHoliday(wd !== undefined ? wd : 4);
          }
        } catch (e) {
          console.error('定休日設定読み込みエラー', e);
        }
      }
    }

    setIsInitialized(true);
  }, []);

  // 定休日を localStorage に保存
  useEffect(() => {
    if (!isInitialized) return;
    const empId = selectedDoctor?.id;
    const config = { weekdayHoliday, holidays: [0, weekdayHoliday] };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    if (empId) {
      localStorage.setItem(weekdayKey(empId), String(weekdayHoliday));
    }
  }, [weekdayHoliday, isInitialized, selectedDoctor]);

  const selectDoctor = (doctor: DoctorItem) => {
    setSelectedDoctor(doctor);
    localStorage.setItem(STORAGE_KEYS.SELECTED_DOCTOR, JSON.stringify(doctor));
    const savedWeekday = localStorage.getItem(weekdayKey(doctor.id));
    if (savedWeekday !== null) {
      const wd = Number(savedWeekday);
      if (!isNaN(wd)) setWeekdayHoliday(wd);
    }
  };

  const clearDoctor = () => {
    setSelectedDoctor(null);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_DOCTOR);
  };

  return {
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
  };
}
