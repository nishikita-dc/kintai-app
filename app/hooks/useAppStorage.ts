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
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3);
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

    // 年月は共通設定から復元（v5_0 になければ v4_0 にフォールバック）
    const savedConfig =
      localStorage.getItem(STORAGE_KEYS.CONFIG) ??
      localStorage.getItem('star_dental_config_v4_0');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.year && parsed.month) {
          setYear(parsed.year);
          setMonth(parsed.month);
        }
      } catch (e) {
        console.error('設定読み込みエラー', e);
      }
    }

    // 定休日はドクター個別設定を優先し、なければ共通設定にフォールバック
    const doctorConfigRaw = docId ? localStorage.getItem(weekdayKey(docId)) : null;
    if (doctorConfigRaw !== null) {
      const wd = Number(doctorConfigRaw);
      if (!isNaN(wd)) setWeekdayHoliday(wd);
    } else if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.weekdayHoliday !== undefined) {
          setWeekdayHoliday(parsed.weekdayHoliday);
        } else if (parsed.holidays) {
          const wd = (parsed.holidays as number[]).find((d) => d !== 0);
          setWeekdayHoliday(wd !== undefined ? wd : 4);
        }
      } catch (e) {
        console.error('定休日設定読み込みエラー', e);
      }
    }

    setIsInitialized(true);
  }, []);

  // 年月・定休日を localStorage に保存
  useEffect(() => {
    if (!isInitialized) return;
    const empId = selectedDoctor?.id;
    const config = { weekdayHoliday, holidays: [0, weekdayHoliday], year, month };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    if (empId) {
      localStorage.setItem(weekdayKey(empId), String(weekdayHoliday));
    }
  }, [weekdayHoliday, year, month, isInitialized, selectedDoctor]);

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
