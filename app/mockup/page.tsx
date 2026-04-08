'use client';

import { useState } from 'react';

// ─── 定数 ──────────────────────────────────────────────────────────
const DOCTOR_LIST = [
  { id: '1030', name: '生野智也', displayName: '生野' },
  { id: '1040', name: '岡田', displayName: '岡田' },
  { id: '1017', name: '露口', displayName: '露口' },
  { id: '1016', name: '松浦', displayName: '松浦' },
  { id: '1059', name: '藤田', displayName: '藤田' },
  { id: '1023', name: '加藤', displayName: '加藤' },
  { id: '1033', name: '岸元', displayName: '岸元' },
  { id: '1020', name: '安達', displayName: '安達' },
  { id: '1013', name: '松本', displayName: '松本' },
  { id: '1019', name: '久保', displayName: '久保' },
  { id: '1036', name: '落窪', displayName: '落窪' },
  { id: '1063', name: '山本', displayName: '山本' },
  { id: '1047', name: '珠央', displayName: '珠央' },
];

// 2026年4月のカレンダーデータ（モック）
const APRIL_CALENDAR = [
  // 週1
  { day: null }, { day: null }, { day: null }, { day: 1, dow: 3 }, { day: 2, dow: 4 }, { day: 3, dow: 5 }, { day: 4, dow: 6 },
  // 週2
  { day: 5, dow: 0 }, { day: 6, dow: 1 }, { day: 7, dow: 2 }, { day: 8, dow: 3 }, { day: 9, dow: 4 }, { day: 10, dow: 5 }, { day: 11, dow: 6 },
  // 週3
  { day: 12, dow: 0 }, { day: 13, dow: 1 }, { day: 14, dow: 2 }, { day: 15, dow: 3 }, { day: 16, dow: 4 }, { day: 17, dow: 5 }, { day: 18, dow: 6 },
  // 週4
  { day: 19, dow: 0 }, { day: 20, dow: 1 }, { day: 21, dow: 2 }, { day: 22, dow: 3 }, { day: 23, dow: 4 }, { day: 24, dow: 5 }, { day: 25, dow: 6 },
  // 週5
  { day: 26, dow: 0 }, { day: 27, dow: 1 }, { day: 28, dow: 2 }, { day: 29, dow: 3 }, { day: 30, dow: 4 }, { day: null }, { day: null },
];

// 祝日（4月）
const HOLIDAYS: Record<number, string> = { 29: '昭和の日' };
// 定休日: 日(0) + 木(4)
const FIXED_HOLIDAYS = [0, 4];
// 振替出勤: 4/17(金) ← 昭和の日週の木が定休なので金に振替
const EXTRA_WORK = [17];
// 有給
const PAID_LEAVE = [14];
// 振替休日
const SUBST_HOLIDAY = [30];

type ScreenKey =
  | 'doctor-select'
  | 'main-step1'
  | 'main-step2'
  | 'main-step3'
  | 'confirm-dialog'
  | 'confirmed';

const SCREENS: { key: ScreenKey; label: string; badge?: string }[] = [
  { key: 'doctor-select', label: 'ドクター選択', badge: 'NEW' },
  { key: 'main-step1', label: 'STEP 1: 基本設定' },
  { key: 'main-step2', label: 'STEP 2: カレンダー' },
  { key: 'main-step3', label: 'STEP 3: プレビュー', badge: 'NEW' },
  { key: 'confirm-dialog', label: '確定ダイアログ', badge: 'NEW' },
  { key: 'confirmed', label: '確定済み状態', badge: 'NEW' },
];

// ─── サブコンポーネント ──────────────────────────────────────────────

function NewBadge() {
  return (
    <span className="ml-1.5 text-[10px] bg-brand-500 text-white font-bold px-1.5 py-0.5 rounded-full leading-none">
      NEW
    </span>
  );
}

function AnnotationBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full ml-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-1 rounded-lg shadow-sm whitespace-nowrap z-20 border border-amber-500">
      ← {children}
    </div>
  );
}

function AppHeader({ onDoctorChange }: { onDoctorChange: () => void }) {
  return (
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
                Ver 5.0
              </span>
            </h1>
            <p className="text-xs text-slate-500">スター歯科クリニック 西宮北口駅前院</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-700">
              <i className="fa-solid fa-user-doctor mr-1 text-brand-500" />
              生野先生
            </p>
            <p className="text-xs text-slate-400 font-mono">ID: 1030</p>
          </div>
          <button
            onClick={onDoctorChange}
            className="text-xs bg-slate-100 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold"
          >
            <i className="fa-solid fa-arrows-rotate" />
            ドクター変更
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── 画面: ドクター選択 ─────────────────────────────────────────────
function DoctorSelectScreen({ onSelect }: { onSelect: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    if (selectedId) return;
    setSelectedId(id);
    setTimeout(() => onSelect(), 600);
  };

  return (
    <div className="min-h-[600px] bg-gradient-to-br from-slate-50 via-brand-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="bg-brand-500 text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
            <i className="fa-solid fa-tooth text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">勤怠管理アプリ</h1>
          <p className="text-sm text-slate-500 mb-2">スター歯科クリニック 西宮北口駅前院</p>
          <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full font-bold">
            Ver 5.0
          </span>
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 inline-flex items-center gap-2 shadow-sm mt-4">
            <i className="fa-solid fa-user-doctor text-brand-500" />
            <p className="text-slate-700 font-bold text-sm">
              {selectedId ? '読み込み中...' : 'ご自身の名前を選択してください'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DOCTOR_LIST.map((doc) => {
            const isSelected = selectedId === doc.id;
            const isOther = selectedId !== null && !isSelected;
            return (
              <button
                key={doc.id}
                onClick={() => handleSelect(doc.id)}
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
                    ${isSelected ? 'bg-white/25' : 'bg-brand-100 text-brand-600 group-hover:bg-brand-200'}
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
                      {doc.displayName}先生
                    </p>
                    <p className={`text-xs font-mono transition-colors duration-300 ${
                      isSelected ? 'text-white/70' : 'text-slate-400'
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

// ─── 画面: STEP 1 基本情報 ───────────────────────────────────────────
function Step1Screen() {
  const [expanded, setExpanded] = useState(false);
  const [wd, setWd] = useState(4);
  const days = ['月', '火', '水', '木', '金', '土'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold mb-4 pb-2 text-slate-700 flex items-center border-b border-slate-200">
        <span className="bg-brand-500 text-white text-xs font-bold mr-3 px-2 py-1 rounded-md">
          STEP 1
        </span>
        <i className="fa-solid fa-user-gear mr-2 text-slate-500" />
        基本情報設定
      </h2>

      {/* 削除された項目の注記 */}
      <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <i className="fa-solid fa-circle-info mr-1" />
        <strong>Ver 5.0 変更点：</strong>従業員ID・氏名の入力欄とドクターIDリストを削除（ドクター選択画面で自動決定）
      </div>

      {/* 年月選択 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">対象年</label>
          <input
            readOnly
            value="2026"
            className="w-full rounded-lg border-slate-300 shadow-sm p-2.5 bg-slate-50 border font-bold text-center"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">対象月</label>
          <input
            readOnly
            value="4"
            className="w-full rounded-lg border-slate-300 shadow-sm p-2.5 bg-slate-50 border font-bold text-center"
          />
        </div>
      </div>

      {/* 定休日設定 */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div className="flex justify-between items-end mb-3">
          <label className="block text-xs font-bold text-slate-500">
            定休日設定 (日曜日 + 任意の曜日)
          </label>
          <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
            ※変更は自動保存されます
          </span>
        </div>
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            disabled
            className="w-10 h-10 rounded-full text-sm font-bold bg-slate-700 text-white shadow-lg cursor-not-allowed opacity-80"
          >
            日
          </button>
          {days.map((day, idx) => {
            const dayIdx = idx + 1;
            return (
              <button
                key={dayIdx}
                onClick={() => setWd(dayIdx)}
                className={`w-10 h-10 rounded-full text-sm font-bold transition-all duration-200 ${
                  wd === dayIdx
                    ? 'bg-brand-600 text-white shadow-lg scale-105'
                    : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-400'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          ※選択した曜日に、祝日週の振替診療が自動設定されます。
        </p>
      </div>

      {/* 祝日アコーディオン */}
      <div className="mt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex justify-between items-center px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded bg-white hover:bg-slate-50 transition"
        >
          <span>
            <i className="fa-regular fa-calendar-days mr-2" />
            2026年の祝日データ確認
          </span>
          <i className={`fa-solid fa-chevron-down text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && (
          <div className="p-3 border border-t-0 border-slate-200 rounded-b grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 max-h-40 overflow-y-auto">
            {[
              ['01-01', '元日'], ['01-13', '成人の日'], ['02-11', '建国記念の日'],
              ['02-23', '天皇誕生日'], ['03-20', '春分の日'], ['04-29', '昭和の日'],
              ['05-03', '憲法記念日'], ['05-04', 'みどりの日'], ['05-05', 'こどもの日'],
            ].map(([date, name]) => (
              <div key={date} className="text-xs flex items-center gap-1">
                <span className="text-slate-400">{date}</span>
                <span className="font-bold text-slate-600">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 画面: STEP 2 カレンダー ─────────────────────────────────────────
function Step2Screen() {
  const weekLabels = ['日', '月', '火', '水', '木', '金', '土'];
  const [showAbsentModal, setShowAbsentModal] = useState(false);

  function getCellStyle(cell: typeof APRIL_CALENDAR[0]) {
    if (!cell.day) return 'bg-slate-50 border-slate-100';
    if (HOLIDAYS[cell.day]) return 'bg-pink-50 border-pink-200';
    if (FIXED_HOLIDAYS.includes(cell.dow!)) return 'bg-slate-100 border-slate-200';
    if (EXTRA_WORK.includes(cell.day)) return 'bg-orange-50 border-orange-200';
    if (PAID_LEAVE.includes(cell.day)) return 'bg-emerald-50 border-emerald-200';
    if (SUBST_HOLIDAY.includes(cell.day)) return 'bg-blue-50 border-blue-200';
    return 'bg-white border-slate-200 hover:brightness-95 cursor-pointer';
  }

  function getCellLabel(cell: typeof APRIL_CALENDAR[0]) {
    if (!cell.day) return '';
    if (HOLIDAYS[cell.day]) return '祝日';
    if (cell.dow === 0) return '定休日';
    if (cell.dow === 4 && !EXTRA_WORK.includes(cell.day)) return '定休日';
    if (EXTRA_WORK.includes(cell.day)) return '振替出勤';
    if (PAID_LEAVE.includes(cell.day)) return '有給';
    if (SUBST_HOLIDAY.includes(cell.day)) return '振替休日';
    return '';
  }

  function getDayColor(dow: number) {
    if (dow === 0) return 'text-red-500';
    if (dow === 6) return 'text-blue-500';
    return 'text-slate-600';
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold mb-4 pb-2 text-slate-700 flex items-center border-b border-slate-200">
        <span className="bg-emerald-500 text-white text-xs font-bold mr-3 px-2 py-1 rounded-md">
          STEP 2
        </span>
        <i className="fa-solid fa-calendar-check mr-2 text-slate-500" />
        例外スケジュールの修正
      </h2>
      <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded">
        <i className="fa-solid fa-wand-magic-sparkles mr-1 text-brand-500" />
        カレンダーをクリックすると「出勤/休み」を切り替えられます。
      </p>

      {/* カレンダー */}
      <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
        <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
          {weekLabels.map((w, i) => (
            <div
              key={i}
              className={`text-center py-2 text-xs font-bold ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600'
              }`}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {APRIL_CALENDAR.map((cell, idx) => {
            const label = getCellLabel(cell);
            return (
              <div
                key={idx}
                className={`h-16 border ${getCellStyle(cell)} p-1 relative group overflow-hidden`}
              >
                {cell.day && (
                  <>
                    <div className="flex justify-between items-start">
                      <span className={`text-sm font-bold ${getDayColor(cell.dow!)}`}>
                        {cell.day}
                      </span>
                      {label && (
                        <span className="text-[9px] font-bold px-1 rounded text-slate-600 bg-white/60">
                          {label.slice(0, 4)}
                        </span>
                      )}
                    </div>
                    {!FIXED_HOLIDAYS.includes(cell.dow!) && !HOLIDAYS[cell.day] && (
                      <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fa-solid fa-pen text-slate-400 bg-white rounded-full p-1 shadow-sm text-xs" />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 例外リスト */}
      <div className="space-y-4">
        {/* お休みリスト */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
              <i className="fa-solid fa-moon text-indigo-400" />
              お休みリスト
            </h3>
            <button
              onClick={() => setShowAbsentModal(true)}
              className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-2.5 py-1 rounded-lg hover:bg-brand-100 transition font-bold"
            >
              <i className="fa-solid fa-plus mr-1" />
              追加
            </button>
          </div>
          <div className="space-y-1.5">
            {[
              { date: '4/3 (金)', type: '祝日', name: '昭和の日 (前週)' },
              { date: '4/14 (火)', type: '有給', name: '' },
              { date: '4/29 (水)', type: '祝日', name: '昭和の日' },
              { date: '4/30 (木)', type: '振替休日', name: '' },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                  item.type === '有給'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : item.type === '振替休日'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-pink-50 border-pink-200 text-pink-700'
                }`}
              >
                <span className="font-bold">{item.date}</span>
                <span className="font-bold">{item.type} {item.name}</span>
                {item.type === '有給' && (
                  <button className="text-slate-400 hover:text-red-400 transition">
                    <i className="fa-solid fa-times" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 休日出勤 */}
        <div>
          <h3 className="text-sm font-bold text-slate-600 flex items-center gap-1.5 mb-2">
            <i className="fa-solid fa-briefcase text-orange-400" />
            休日出勤リスト
          </h3>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-orange-50 border-orange-200 text-xs text-orange-700">
            <span className="font-bold">4/17 (金)</span>
            <span className="font-bold">祝日振替診療</span>
            <span className="text-[10px] text-orange-400">自動設定</span>
          </div>
        </div>

        {/* 時間変更 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
              <i className="fa-solid fa-clock text-purple-400" />
              時間変更リスト
            </h3>
            <button className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-2.5 py-1 rounded-lg hover:bg-brand-100 transition font-bold">
              <i className="fa-solid fa-plus mr-1" />
              追加
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center py-3">時間変更なし</p>
        </div>
      </div>

      {/* お休み追加モーダル */}
      {showAbsentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAbsentModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-moon text-indigo-400" />
              お休みを追加
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">日付</label>
                <input type="date" defaultValue="2026-04-21" className="w-full border border-slate-300 rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">種別</label>
                <div className="grid grid-cols-2 gap-2">
                  {['有給', '欠勤', '振替休日'].map((t) => (
                    <button key={t} className={`border rounded-lg px-3 py-2 text-xs font-bold transition ${t === '有給' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAbsentModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-bold hover:bg-slate-50 transition">
                キャンセル
              </button>
              <button onClick={() => setShowAbsentModal(false)} className="flex-1 bg-brand-500 text-white rounded-lg py-2 text-sm font-bold hover:bg-brand-600 transition">
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 画面: STEP 3 プレビュー ─────────────────────────────────────────
function Step3Screen({ onConfirm }: { onConfirm: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirmClick = () => {
    setIsConfirming(true);
    // 1.5秒後にローディング終了→確定ダイアログへ
    setTimeout(() => {
      setIsConfirming(false);
      onConfirm();
    }, 1500);
  };
  type PreviewRow = { date: string; week: string; type: string; in: string; out: string; sub: boolean; off?: boolean };
  const previewRows: PreviewRow[] = [
    { date: '4/1', week: '水', type: '通常', in: '09:00', out: '19:30', sub: false },
    { date: '4/2', week: '木', type: '定休日', in: '-', out: '-', sub: false, off: true },
    { date: '4/6', week: '月', type: '通常', in: '09:00', out: '19:30', sub: false },
    { date: '4/7', week: '火', type: '通常', in: '09:00', out: '19:30', sub: false },
    { date: '4/8', week: '水', type: '通常', in: '09:00', out: '19:30', sub: false },
    { date: '4/14', week: '火', type: '有給', in: '-', out: '-', sub: false, off: true },
    { date: '4/17', week: '金', type: '祝日振替診療', in: '09:00', out: '17:30', sub: true },
    { date: '4/22', week: '水', type: '通常', in: '09:00', out: '19:30', sub: false },
    { date: '4/29', week: '水', type: '祝日（昭和の日）', in: '-', out: '-', sub: false, off: true },
    { date: '4/30', week: '木', type: '振替休日', in: '-', out: '-', sub: false, off: true },
  ];

  function rowClass(row: PreviewRow) {
    if (row.type === '通常') return 'border-slate-200 text-slate-500';
    if (row.sub) return 'border-brand-500 bg-brand-50 text-brand-600 font-bold';
    if (row.type === '有給') return 'border-emerald-200 bg-emerald-50 text-emerald-600';
    if (row.type === '振替休日') return 'border-blue-200 bg-blue-50 text-blue-600';
    if (row.type.includes('祝日')) return 'border-red-200 bg-red-50 text-red-600';
    return 'border-slate-200 text-slate-500';
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-brand-100 p-6">
      <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b pb-3">
        <i className="fa-solid fa-table-list text-brand-500" />
        作成結果プレビュー
      </h3>

      {/* 集計サマリ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-center">
          <div className="text-xs text-brand-500 font-bold mb-1">出勤日数</div>
          <div className="text-2xl font-bold text-brand-700">19<span className="text-sm ml-1">日</span></div>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
          <div className="text-xs text-orange-500 font-bold mb-1">休日出勤</div>
          <div className="text-2xl font-bold text-orange-700">1<span className="text-sm ml-1">日</span></div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 col-span-2">
          <div className="flex justify-between items-end mb-2 border-b border-slate-200 pb-1">
            <div className="text-xs text-slate-500 font-bold">お休み合計</div>
            <div className="text-xl font-bold text-slate-700">1<span className="text-sm ml-1">日</span></div>
          </div>
          <div className="flex justify-between gap-2 text-xs">
            <div className="text-center flex-1 bg-white rounded border border-emerald-100 p-1">
              <div className="text-emerald-500 font-bold">有給</div>
              <div>1日</div>
            </div>
            <div className="text-center flex-1 bg-white rounded border border-blue-100 p-1">
              <div className="text-blue-500 font-bold">振替</div>
              <div>1日</div>
            </div>
            <div className="text-center flex-1 bg-white rounded border border-red-100 p-1">
              <div className="text-red-500 font-bold">欠勤</div>
              <div>0日</div>
            </div>
          </div>
        </div>
      </div>

      {/* プレビューテーブル */}
      <div className="overflow-hidden border border-slate-200 rounded-lg mb-6">
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                {['日付', '曜日', '区分', '出勤', '退勤'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {previewRows.map((row, idx) => (
                <tr key={idx} className={`hover:bg-slate-50 transition ${'off' in row && row.off ? 'bg-slate-50/50' : ''}`}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{row.date}</td>
                  <td className={`px-4 py-2.5 whitespace-nowrap font-bold ${
                    row.week === '日' ? 'text-red-500' : row.week === '土' ? 'text-blue-500' : 'text-slate-600'
                  }`}>{row.week}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${rowClass(row)}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-700">{row.in}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-700">{row.out}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* アクションエリア */}
      <div className="rounded-xl border border-brand-100 overflow-hidden">
        <div className="bg-brand-50 px-5 pt-5 pb-4 space-y-3">
          <p className="text-sm text-brand-800 font-bold text-center">
            内容を確認して問題なければ操作してください
          </p>

          {/* 主アクション：確定して送信予約 */}
          <button
            onClick={handleConfirmClick}
            disabled={isConfirming}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-base"
          >
            {isConfirming ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                送信予約中...
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane" />
                確定して送信予約する
              </>
            )}
          </button>

          {/* 自動送信の案内ボックス */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mt-0.5">
              <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">月末に自動送信されます</p>
              <p className="text-xs text-amber-700 mt-0.5">
                確定すると月末 20:00 に山本さんへCSVが自動送信されます。確定後も取り消して再編集できます。
              </p>
            </div>
          </div>
        </div>

        {/* 副アクション：CSVダウンロード */}
        <div className="bg-white px-5 py-3 border-t border-brand-100 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400 font-mono truncate min-w-0">
            202604_1030_生野智也.csv
          </p>
          <button className="flex-shrink-0 text-sm border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 font-bold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2">
            <i className="fa-solid fa-file-csv text-green-600" />
            CSVを保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 画面: 確定ダイアログ ────────────────────────────────────────────
function ConfirmDialogScreen({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="relative">
      {/* 背景（プレビュー画面のぼかし表示） */}
      <div className="filter blur-sm opacity-40 pointer-events-none">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 border-b pb-3">作成結果プレビュー</h3>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-center col-span-2 h-16" />
            <div className="bg-slate-50 border rounded-lg p-3 col-span-2 h-16" />
          </div>
          <div className="border border-slate-200 rounded-lg h-32 mb-4" />
        </div>
      </div>

      {/* ダイアログ */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-200">
          {/* アイコン */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center border-4 border-brand-100">
              <i className="fa-solid fa-paper-plane text-brand-500 text-2xl" />
            </div>
          </div>

          <h3 className="font-bold text-slate-800 text-center text-lg mb-2">
            勤怠データを確定しますか？
          </h3>

          <div className="bg-slate-50 rounded-lg p-3 mb-5 text-xs text-slate-600 border border-slate-200">
            <p className="font-bold text-slate-700 mb-1">
              <i className="fa-solid fa-calendar-check mr-1 text-brand-500" />
              2026年4月分 / 生野先生
            </p>
            <p>月末（4月30日 20:00）に山本さんへ自動送信されます。</p>
            <p className="mt-1 text-slate-500">確定後も「確定を取り消す」で再編集できます。</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-3 font-bold text-sm hover:bg-slate-50 transition"
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-3 font-bold text-sm shadow-md transition flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-check" />
              確定する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 画面: 確定済み状態 ──────────────────────────────────────────────
function ConfirmedScreen({ onCancel }: { onCancel: () => void }) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  return (
    <div className="space-y-4">
      {/* 確定済みバナー */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-circle-check text-green-500 text-xl" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-green-700 mb-0.5">
            2026年4月分を確定しました
          </p>
          <p className="text-xs text-green-600">
            確定日時: 2026/4/8 15:30 &nbsp;|&nbsp; 月末に山本さんへ自動送信されます
          </p>
          <button
            onClick={() => setShowCancelDialog(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold border border-green-400 text-green-700 bg-white hover:bg-green-50 rounded-lg px-3 py-1.5 transition"
          >
            <i className="fa-solid fa-rotate-left" />
            確定を取り消す
          </button>
        </div>
      </div>

      {/* グレーアウトされたプレビュー */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 relative overflow-hidden">
        {/* ロックオーバーレイ */}
        <div className="absolute inset-0 bg-white/60 z-10 flex flex-col items-center justify-center gap-2 rounded-xl">
          <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 text-center shadow-sm">
            <i className="fa-solid fa-lock text-slate-400 text-2xl mb-2 block" />
            <p className="text-sm font-bold text-slate-600">確定済みのため編集できません</p>
            <button
              onClick={() => setShowCancelDialog(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold border border-brand-300 text-brand-600 bg-white hover:bg-brand-50 rounded-lg px-3 py-1.5 transition"
            >
              <i className="fa-solid fa-rotate-left" />
              確定を取り消して編集する
            </button>
          </div>
        </div>

        {/* 背景コンテンツ（グレーアウト） */}
        <h3 className="font-bold text-slate-300 mb-4 border-b border-slate-100 pb-3">作成結果プレビュー</h3>
        <div className="grid grid-cols-4 gap-4 mb-4 opacity-40">
          <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-center">
            <div className="text-xs text-brand-300 mb-1">出勤日数</div>
            <div className="text-2xl font-bold text-brand-300">19<span className="text-sm">日</span></div>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
            <div className="text-xs text-orange-300 mb-1">休日出勤</div>
            <div className="text-2xl font-bold text-orange-300">1<span className="text-sm">日</span></div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 col-span-2 opacity-60">
            <div className="h-12" />
          </div>
        </div>
        <div className="border border-slate-100 rounded-lg h-24 opacity-30 bg-slate-50 mb-4" />
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 opacity-40">
          <div className="h-10 bg-slate-200 rounded-lg mb-2" />
          <div className="h-10 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* 確定取り消し確認ダイアログ */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-200">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center border-4 border-orange-100">
                <i className="fa-solid fa-rotate-left text-orange-500 text-xl" />
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-center text-lg mb-2">
              確定を取り消しますか？
            </h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              月末の自動送信予約がキャンセルされます。<br />
              再度確定することで再予約できます。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-3 font-bold text-sm hover:bg-slate-50 transition"
              >
                戻る
              </button>
              <button
                onClick={() => { setShowCancelDialog(false); onCancel(); }}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-bold text-sm shadow-md transition flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-rotate-left" />
                取り消す
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── メインモックアップページ ────────────────────────────────────────
export default function MockupPage() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('doctor-select');

  function goTo(key: ScreenKey) {
    setActiveScreen(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderScreen() {
    switch (activeScreen) {
      case 'doctor-select':
        return <DoctorSelectScreen onSelect={() => goTo('main-step1')} />;
      case 'main-step1':
        return (
          <div className="min-h-screen pb-20">
            <AppHeader onDoctorChange={() => goTo('doctor-select')} />
            <main className="max-w-3xl mx-auto p-4 space-y-4 mt-4">
              <Step1Screen />
              <div className="flex justify-end">
                <button
                  onClick={() => goTo('main-step2')}
                  className="text-sm bg-brand-500 hover:bg-brand-600 text-white font-bold px-5 py-2.5 rounded-lg transition flex items-center gap-2"
                >
                  次へ: STEP 2 カレンダー
                  <i className="fa-solid fa-arrow-right" />
                </button>
              </div>
            </main>
          </div>
        );
      case 'main-step2':
        return (
          <div className="min-h-screen pb-20">
            <AppHeader onDoctorChange={() => goTo('doctor-select')} />
            <main className="max-w-3xl mx-auto p-4 space-y-4 mt-4">
              <Step2Screen />
              <div className="flex justify-end">
                <button
                  onClick={() => goTo('main-step3')}
                  className="text-sm bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-lg transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-wand-magic-sparkles" />
                  データを作成・プレビュー
                </button>
              </div>
            </main>
          </div>
        );
      case 'main-step3':
        return (
          <div className="min-h-screen pb-20">
            <AppHeader onDoctorChange={() => goTo('doctor-select')} />
            <main className="max-w-3xl mx-auto p-4 mt-4">
              <Step3Screen onConfirm={() => goTo('confirm-dialog')} />
            </main>
          </div>
        );
      case 'confirm-dialog':
        return (
          <div className="min-h-screen pb-20">
            <AppHeader onDoctorChange={() => goTo('doctor-select')} />
            <main className="max-w-3xl mx-auto p-4 mt-4">
              <ConfirmDialogScreen
                onConfirm={() => goTo('confirmed')}
                onCancel={() => goTo('main-step3')}
              />
            </main>
          </div>
        );
      case 'confirmed':
        return (
          <div className="min-h-screen pb-20">
            <AppHeader onDoctorChange={() => goTo('doctor-select')} />
            <main className="max-w-3xl mx-auto p-4 mt-4">
              <ConfirmedScreen onCancel={() => goTo('main-step3')} />
            </main>
          </div>
        );
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* モックアップ用ナビゲーションバー */}
      <div className="bg-slate-900 text-white sticky top-0 z-50 shadow-xl">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-3 py-2 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <span className="text-slate-300 text-xs font-mono flex-1 text-center">
              勤怠管理アプリ Ver 5.0 — UI モックアップ
            </span>
            <span className="text-xs bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
              MOCKUP
            </span>
          </div>
          <div className="flex overflow-x-auto gap-0.5 py-1 scrollbar-hide">
            {SCREENS.map((s) => (
              <button
                key={s.key}
                onClick={() => goTo(s.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-bold transition flex-shrink-0 ${
                  activeScreen === s.key
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {s.label}
                {s.badge && (
                  <span className={`text-[10px] font-bold px-1 rounded ${
                    activeScreen === s.key ? 'bg-white/30 text-white' : 'bg-brand-500 text-white'
                  }`}>
                    {s.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 画面コンテンツ */}
      <div>{renderScreen()}</div>

      {/* 画面遷移ガイド */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/90 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm flex items-center gap-3 shadow-lg z-40">
        <i className="fa-solid fa-circle-info text-brand-400" />
        <span>上部タブで画面を切り替え｜ボタンをクリックして画面遷移を体験</span>
      </div>
    </div>
  );
}
