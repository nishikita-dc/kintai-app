'use client';

import { DOCTOR_LIST } from '@/lib/constants';
import type { DoctorItem } from '@/types';

interface DoctorSelectScreenProps {
  onSelect: (doctor: DoctorItem) => void;
}

export default function DoctorSelectScreen({ onSelect }: DoctorSelectScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <div className="bg-brand-500 text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
            <i className="fa-solid fa-tooth text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">勤怠管理アプリ</h1>
          <p className="text-sm text-slate-500 mb-6">スター歯科クリニック 西宮北口駅前院</p>
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 inline-flex items-center gap-2 shadow-sm">
            <i className="fa-solid fa-user-doctor text-brand-500" />
            <p className="text-slate-700 font-bold text-sm">ドクターを選択してください</p>
          </div>
        </div>

        {/* ドクターカード一覧 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DOCTOR_LIST.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onSelect(doc)}
              className="bg-white border border-slate-200 rounded-xl p-4 text-left shadow-sm hover:shadow-md hover:border-brand-300 hover:bg-brand-50 transition-all duration-200 group active:scale-95"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center group-hover:bg-brand-200 transition flex-shrink-0">
                  <i className="fa-solid fa-user-doctor text-sm" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-700 group-hover:text-brand-700 transition truncate">
                    {doc.name}先生
                  </p>
                  <p className="text-xs text-slate-400 font-mono">ID: {doc.id}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          選択したドクターは次回アクセス時も自動的に引き継がれます
        </p>
      </div>
    </div>
  );
}
