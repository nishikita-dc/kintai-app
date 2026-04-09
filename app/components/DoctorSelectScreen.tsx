'use client';

import { useState } from 'react';
import { DOCTOR_LIST } from '@/lib/constants';
import type { DoctorItem } from '@/types';

interface DoctorSelectScreenProps {
  onSelect: (doctor: DoctorItem) => void;
}

export default function DoctorSelectScreen({ onSelect }: DoctorSelectScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (doc: DoctorItem) => {
    if (selectedId) return; // 選択処理中は無効
    setSelectedId(doc.id);
    // 視覚フィードバックを見せてから画面遷移
    setTimeout(() => onSelect(doc), 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="スター歯科クリニック" className="w-16 h-16 rounded-2xl shadow-lg mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-1">勤怠管理アプリ</h1>
          <p className="text-sm text-slate-500 mb-6">医療法人社団 スター歯科クリニック</p>
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 inline-flex items-center gap-2 shadow-sm">
            <i className="fa-solid fa-user-doctor text-brand-500" />
            <p className="text-slate-700 font-bold text-sm">
              {selectedId ? '読み込み中...' : 'ドクターを選択してください'}
            </p>
          </div>
        </div>

        {/* ドクターカード一覧 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DOCTOR_LIST.map((doc) => {
            const isSelected = selectedId === doc.id;
            const isOther = selectedId !== null && !isSelected;
            return (
              <button
                key={doc.id}
                onClick={() => handleSelect(doc)}
                disabled={!!selectedId}
                className={`
                  relative border rounded-xl p-4 text-left shadow-sm transition-all duration-300
                  ${isSelected
                    ? 'bg-brand-500 border-brand-500 shadow-xl scale-[1.04]'
                    : isOther
                      ? 'bg-white border-slate-200 opacity-40 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:shadow-md hover:border-brand-300 hover:bg-brand-50 active:scale-95 group'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300
                    ${isSelected
                      ? 'bg-white/25'
                      : 'bg-brand-100 text-brand-600 group-hover:bg-brand-200'
                    }
                  `}>
                    {isSelected
                      ? <i className="fa-solid fa-check text-white text-base" />
                      : <i className="fa-solid fa-user-doctor text-sm text-brand-600" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold truncate transition-colors duration-300 ${
                      isSelected ? 'text-white' : 'text-slate-700 group-hover:text-brand-700'
                    }`}>
                      {doc.name}先生
                    </p>
                    <p className={`text-xs font-mono transition-colors duration-300 ${
                      isSelected ? 'text-white/70' : 'text-slate-400'
                    }`}>
                      ID: {doc.id}
                    </p>
                  </div>
                </div>
                {/* 選択時のスピナー */}
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
