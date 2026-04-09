'use client';

import { useState, useEffect } from 'react';
import { DOCTOR_LIST } from '@/lib/constants';
import type { DoctorItem } from '@/types';

interface DoctorSelectScreenProps {
  onSelect: (doctor: DoctorItem) => void;
}

export default function DoctorSelectScreen({ onSelect }: DoctorSelectScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [doctorList, setDoctorList] = useState<DoctorItem[]>(DOCTOR_LIST);

  useEffect(() => {
    fetch('/api/doctors')
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { doctors?: DoctorItem[] };
        if (d.doctors && d.doctors.length > 0) setDoctorList(d.doctors);
      })
      .catch(() => { /* デフォルトのまま */ });
  }, []);

  const handleSelect = (doc: DoctorItem) => {
    if (selectedId) return;
    setSelectedId(doc.id);
    setTimeout(() => onSelect(doc), 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <div className="relative inline-block mb-5">
            <div className="w-20 h-20 bg-gradient-to-br from-brand-400 to-amber-400 rounded-3xl shadow-xl flex items-center justify-center mx-auto">
              <img src="/logo.png" alt="スター歯科クリニック" className="w-14 h-14" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
              <i className="fa-solid fa-tooth text-brand-500 text-xs" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">勤怠管理アプリ</h1>
          <p className="text-sm text-slate-400 mb-6">医療法人社団 スター歯科クリニック</p>
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-brand-200 dark:border-slate-600 px-5 py-3 inline-flex items-center gap-2 shadow-sm">
            <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-user-doctor text-brand-500 text-xs" />
            </div>
            <p className="text-slate-700 dark:text-slate-200 font-bold text-sm">
              {selectedId ? '読み込み中...' : 'ドクターを選択してください'}
            </p>
          </div>
        </div>

        {/* ドクターカード一覧 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {doctorList.map((doc) => {
            const isSelected = selectedId === doc.id;
            const isOther = selectedId !== null && !isSelected;
            const initial = doc.name.slice(0, 1);
            return (
              <button
                key={doc.id}
                onClick={() => handleSelect(doc)}
                disabled={!!selectedId}
                className={`
                  relative rounded-2xl p-4 text-left transition-all duration-300
                  ${isSelected
                    ? 'bg-gradient-to-br from-brand-500 to-amber-500 shadow-xl scale-[1.04] border-2 border-brand-400'
                    : isOther
                      ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-brand-300 hover:-translate-y-0.5 active:scale-95 group'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-2 py-1">
                  <div className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300
                    ${isSelected
                      ? 'bg-white/25'
                      : 'bg-gradient-to-br from-brand-100 to-amber-100 group-hover:from-brand-200 group-hover:to-amber-200'
                    }
                  `}>
                    {isSelected
                      ? <i className="fa-solid fa-check text-white text-lg" />
                      : <span className="text-lg font-black text-brand-600">{initial}</span>
                    }
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p className={`font-bold truncate transition-colors duration-300 ${
                      isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-200 group-hover:text-brand-700'
                    }`}>
                      {doc.name}先生
                    </p>
                    <p className={`text-[10px] font-mono transition-colors duration-300 ${
                      isSelected ? 'text-white/60' : 'text-slate-400'
                    }`}>
                      ID: {doc.id}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <i className="fa-solid fa-spinner fa-spin text-white/80 text-xs" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          選択したドクターは次回アクセス時も自動的に引き継がれます
        </p>
      </div>
    </div>
  );
}
