'use client';

import { useState } from 'react';

// ── 型定義 ────────────────────────────────────────────────────────────

type DayType =
  | 'work'       // 通常出勤（青）
  | 'extra'      // 休日出勤・振替出勤（オレンジ）
  | 'paid'       // 有給（緑）
  | 'unpaid'     // 欠勤（赤）
  | 'sub_off'    // 振替休日（紫）
  | 'holiday'    // 祝日（黄）
  | 'fixed_off'  // 定休（グレー）
  | 'empty';     // 空白セル

interface CalendarDay {
  day: number | null;
  type: DayType;
  label?: string; // 祝日名など
}

interface SpecialEvent {
  date: string;  // "4/14" など
  type: DayType;
  label: string;
  time?: string; // "09:00〜19:30"
}

interface DoctorConfirm {
  id: string;
  name: string;
  confirmedAt: string;
  summary: { workDays: number; extraDays: number; absentPaid: number; absentUnpaid: number; absentSub: number };
  calendar: CalendarDay[];
  events: SpecialEvent[];
}

// ── 2026年4月カレンダー生成ユーティリティ ─────────────────────────────
// 4月1日 = 水曜（0=月〜6=日 基準で index 2）

function buildAprilCalendar(config: {
  fixedOff: number[];      // 0=月〜6=日
  extraDays: number[];     // 振替出勤する日付
  paidDays: number[];      // 有給の日付
  unpaidDays: number[];    // 欠勤の日付
  subOffDays: number[];    // 振替休日の日付
}): CalendarDay[] {
  const HOLIDAYS: Record<number, string> = { 29: '昭和の日' };
  // April 1 = Wednesday = Mon-first index 2
  const startDow = 2; // Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  const days: CalendarDay[] = [];

  // 先頭の空白
  for (let i = 0; i < startDow; i++) {
    days.push({ day: null, type: 'empty' });
  }

  for (let d = 1; d <= 30; d++) {
    const dow = (startDow + d - 1) % 7;
    const isFixedOff = config.fixedOff.includes(dow);
    const isHoliday = d in HOLIDAYS;
    const isExtra = config.extraDays.includes(d);
    const isPaid = config.paidDays.includes(d);
    const isUnpaid = config.unpaidDays.includes(d);
    const isSubOff = config.subOffDays.includes(d);

    let type: DayType;
    let label: string | undefined;

    if (isPaid)         { type = 'paid'; }
    else if (isUnpaid)  { type = 'unpaid'; }
    else if (isSubOff)  { type = 'sub_off'; }
    else if (isHoliday) { type = 'holiday'; label = HOLIDAYS[d]; }
    else if (isExtra)   { type = 'extra'; }
    else if (isFixedOff){ type = 'fixed_off'; }
    else                { type = 'work'; }

    days.push({ day: d, type, label });
  }

  // 末尾の空白（7の倍数になるよう）
  while (days.length % 7 !== 0) {
    days.push({ day: null, type: 'empty' });
  }

  return days;
}

// ── モックデータ ──────────────────────────────────────────────────────

// 定休: 日(6) + 木(3)  ← Mon-first では Sun=6, Thu=3
const COMMON_OFF = [3, 6]; // Thu, Sun in Mon-first

const MOCK_MONTHS = ['2026-05', '2026-04', '2026-03'];

const MOCK_CONFIRMED_APRIL: DoctorConfirm[] = [
  {
    id: '1030', name: '生野',
    confirmedAt: '2026-04-28T00:15:00.000Z',
    summary: { workDays: 17, extraDays: 1, absentPaid: 1, absentUnpaid: 0, absentSub: 1 },
    calendar: buildAprilCalendar({
      fixedOff: COMMON_OFF,
      extraDays: [17],
      paidDays: [14],
      unpaidDays: [],
      subOffDays: [30],
    }),
    events: [
      { date: '4/17', type: 'extra',   label: '振替出勤', time: '09:00〜19:30' },
      { date: '4/14', type: 'paid',    label: '有給休暇' },
      { date: '4/29', type: 'holiday', label: '昭和の日（祝日）' },
      { date: '4/30', type: 'sub_off', label: '振替休日' },
    ],
  },
  {
    id: '1017', name: '露口',
    confirmedAt: '2026-04-25T05:30:00.000Z',
    summary: { workDays: 15, extraDays: 0, absentPaid: 2, absentUnpaid: 0, absentSub: 0 },
    calendar: buildAprilCalendar({
      fixedOff: COMMON_OFF,
      extraDays: [],
      paidDays: [7, 21],
      unpaidDays: [],
      subOffDays: [],
    }),
    events: [
      { date: '4/7',  type: 'paid',    label: '有給休暇' },
      { date: '4/21', type: 'paid',    label: '有給休暇' },
      { date: '4/29', type: 'holiday', label: '昭和の日（祝日）' },
    ],
  },
  {
    id: '1016', name: '松浦',
    confirmedAt: '2026-04-27T02:00:00.000Z',
    summary: { workDays: 16, extraDays: 1, absentPaid: 1, absentUnpaid: 0, absentSub: 0 },
    calendar: buildAprilCalendar({
      fixedOff: COMMON_OFF,
      extraDays: [17],
      paidDays: [14],
      unpaidDays: [],
      subOffDays: [],
    }),
    events: [
      { date: '4/17', type: 'extra',   label: '振替出勤', time: '09:00〜19:30' },
      { date: '4/14', type: 'paid',    label: '有給休暇' },
      { date: '4/29', type: 'holiday', label: '昭和の日（祝日）' },
    ],
  },
  {
    id: '1059', name: '藤田',
    confirmedAt: '2026-04-26T09:45:00.000Z',
    summary: { workDays: 16, extraDays: 0, absentPaid: 0, absentUnpaid: 1, absentSub: 0 },
    calendar: buildAprilCalendar({
      fixedOff: COMMON_OFF,
      extraDays: [],
      paidDays: [],
      unpaidDays: [22],
      subOffDays: [],
    }),
    events: [
      { date: '4/22', type: 'unpaid',  label: '欠勤' },
      { date: '4/29', type: 'holiday', label: '昭和の日（祝日）' },
    ],
  },
  {
    id: '1023', name: '加藤',
    confirmedAt: '2026-04-29T10:30:00.000Z',
    summary: { workDays: 17, extraDays: 0, absentPaid: 0, absentUnpaid: 0, absentSub: 0 },
    calendar: buildAprilCalendar({
      fixedOff: COMMON_OFF,
      extraDays: [],
      paidDays: [],
      unpaidDays: [],
      subOffDays: [],
    }),
    events: [
      { date: '4/29', type: 'holiday', label: '昭和の日（祝日）' },
    ],
  },
];

const MOCK_NOT_CONFIRMED_APRIL = [
  { id: '1033', name: '岸元' },
  { id: '1020', name: '安達' },
  { id: '1013', name: '松本' },
  { id: '1019', name: '久保' },
  { id: '1036', name: '落窪' },
  { id: '1063', name: '山本' },
  { id: '1040', name: '岡田' },
  { id: '1047', name: '珠央' },
  { id: '1084', name: '末松' },
  { id: '1085', name: '水田' },
  { id: '1086', name: '有馬' },
  { id: '1087', name: '辰己' },
  { id: '1088', name: '楠元' },
  { id: '1089', name: '桑迫' },
];

// ── スタイルヘルパー ──────────────────────────────────────────────────

function dayTypeStyle(type: DayType): string {
  switch (type) {
    case 'work':      return 'bg-indigo-100 text-indigo-700 font-medium';
    case 'extra':     return 'bg-orange-100 text-orange-700 font-bold ring-1 ring-orange-300';
    case 'paid':      return 'bg-emerald-100 text-emerald-700 font-medium';
    case 'unpaid':    return 'bg-red-100 text-red-700 font-medium';
    case 'sub_off':   return 'bg-purple-100 text-purple-700 font-medium';
    case 'holiday':   return 'bg-amber-100 text-amber-700 font-medium';
    case 'fixed_off': return 'bg-gray-100 text-gray-400';
    case 'empty':     return '';
  }
}

function eventIcon(type: DayType): string {
  switch (type) {
    case 'extra':     return '🔄';
    case 'paid':      return '🌿';
    case 'unpaid':    return '⚠️';
    case 'sub_off':   return '🔁';
    case 'holiday':   return '🎌';
    default:          return '📅';
  }
}

function eventBadge(type: DayType): string {
  switch (type) {
    case 'extra':     return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'paid':      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'unpaid':    return 'bg-red-50 text-red-700 border-red-200';
    case 'sub_off':   return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'holiday':   return 'bg-amber-50 text-amber-700 border-amber-200';
    default:          return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${y}年${Number(mo)}月`;
}

// ── カレンダーコンポーネント ──────────────────────────────────────────

function MiniCalendar({ days }: { days: CalendarDay[] }) {
  const DOW_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="select-none">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 mb-1">
        {DOW_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 6 ? 'text-red-400' : i === 5 ? 'text-blue-400' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>
      {/* 日付グリッド */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
          {week.map((cell, ci) => (
            <div
              key={ci}
              className={`h-8 flex flex-col items-center justify-center rounded text-xs relative ${
                cell.type === 'empty' ? '' : dayTypeStyle(cell.type)
              }`}
            >
              {cell.day !== null && (
                <>
                  <span>{cell.day}</span>
                  {cell.label && (
                    <span className="text-[9px] leading-none opacity-80 truncate max-w-full px-0.5 hidden sm:block">
                      {cell.label.length > 3 ? cell.label.slice(0, 3) : cell.label}
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* 凡例 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {([
          ['work',      '出勤'],
          ['extra',     '振替出勤'],
          ['paid',      '有給'],
          ['unpaid',    '欠勤'],
          ['sub_off',   '振替休日'],
          ['holiday',   '祝日'],
          ['fixed_off', '定休'],
        ] as [DayType, string][]).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${dayTypeStyle(type)}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ドクターカードコンポーネント ─────────────────────────────────────

function DoctorCard({ entry, isOpen, onToggle }: {
  entry: DoctorConfirm;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { summary } = entry;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isOpen ? 'border-indigo-300 shadow-md' : 'border-gray-200'}`}>
      {/* サマリー行（クリックで展開） */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        {/* 展開アイコン */}
        <span className={`text-gray-400 text-sm transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>▶</span>

        {/* 名前 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800">{entry.name}</span>
            <span className="text-xs text-gray-400">ID: {entry.id}</span>
            <span className="text-xs text-gray-400">確定: {formatDateTime(entry.confirmedAt)}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs">
            <span className="text-indigo-600">出勤 <strong>{summary.workDays}</strong>日{summary.extraDays > 0 && <span className="text-orange-500">（振替出勤 {summary.extraDays}日含む）</span>}</span>
            {summary.absentPaid > 0   && <span className="text-emerald-600">有給 <strong>{summary.absentPaid}</strong>日</span>}
            {summary.absentUnpaid > 0 && <span className="text-red-500">欠勤 <strong>{summary.absentUnpaid}</strong>日</span>}
            {summary.absentSub > 0    && <span className="text-purple-600">振替休日 <strong>{summary.absentSub}</strong>日</span>}
          </div>
        </div>

        {/* CSVボタン（常に表示） */}
        <span
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 text-xs bg-white text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors font-medium cursor-pointer"
        >
          ⬇ CSV
        </span>
      </button>

      {/* 展開エリア */}
      {isOpen && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-5">

          {/* カレンダー */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">カレンダー</p>
            <MiniCalendar days={entry.calendar} />
          </div>

          {/* 特記事項 */}
          {entry.events.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">特記事項</p>
              <div className="space-y-1.5">
                {entry.events.map((ev, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${eventBadge(ev.type)}`}>
                    <span>{eventIcon(ev.type)}</span>
                    <span className="font-semibold">{ev.date}</span>
                    <span>{ev.label}</span>
                    {ev.time && <span className="text-xs opacity-70">{ev.time}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────────────────

export default function AdminMockupPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-04');
  const [openDoctorId, setOpenDoctorId] = useState<string | null>('1030');

  const totalDoctors = MOCK_CONFIRMED_APRIL.length + MOCK_NOT_CONFIRMED_APRIL.length;
  const confirmedCount = MOCK_CONFIRMED_APRIL.length;
  const progressPercent = Math.round((confirmedCount / totalDoctors) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="スター歯科クリニック" className="w-9 h-9 flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-gray-800 leading-tight">勤怠管理ダッシュボード</h1>
                <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">モックアップ</span>
              </div>
              <p className="text-xs text-gray-400">医療法人社団スター歯科クリニック</p>
            </div>
          </div>
          <a href="/admin/" className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors">
            ← 本番画面
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* 月選択 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">対象月を選択</p>
          <div className="flex flex-wrap gap-2">
            {MOCK_MONTHS.map((m, idx) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedMonth === m
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {formatMonthLabel(m)}
                {idx === 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-normal ${selectedMonth === m ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                    最新
                  </span>
                )}
              </button>
            ))}
          </div>
          {selectedMonth === '2026-05' && (
            <p className="mt-3 text-sm text-gray-400 bg-gray-50 rounded-xl p-3 text-center">
              2026年5月はまだ提出期間中です。確定データがありません。
            </p>
          )}
          {selectedMonth === '2026-03' && (
            <p className="mt-3 text-sm text-gray-400 bg-gray-50 rounded-xl p-3 text-center">
              2026年3月は全員分のデータが確定済みです。
            </p>
          )}
        </section>

        {/* 2026年4月の状況 */}
        {selectedMonth === '2026-04' && (
          <section className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-800">2026年4月 提出状況</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {confirmedCount}名 / {totalDoctors}名 確定済み
                </p>
              </div>
              <button className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-2 hover:bg-indigo-100 transition-colors font-medium">
                ⬇ 全員CSV一括
              </button>
            </div>

            {/* プログレスバー */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>提出率</span>
                <span className="font-semibold text-indigo-600">{progressPercent}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 確定済みドクターリスト */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-emerald-700">✅ 確定済み</span>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-2 py-0.5">
                  {confirmedCount}名
                </span>
              </div>
              <div className="space-y-2">
                {MOCK_CONFIRMED_APRIL.map((entry) => (
                  <DoctorCard
                    key={entry.id}
                    entry={entry}
                    isOpen={openDoctorId === entry.id}
                    onToggle={() => setOpenDoctorId(openDoctorId === entry.id ? null : entry.id)}
                  />
                ))}
              </div>
            </div>

            {/* 未提出ドクター */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-gray-500">⏳ 未提出</span>
                <span className="bg-gray-100 text-gray-500 text-xs font-bold rounded-full px-2 py-0.5">
                  {MOCK_NOT_CONFIRMED_APRIL.length}名
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {MOCK_NOT_CONFIRMED_APRIL.map((d) => (
                  <div key={d.id} className="bg-gray-100 text-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium">
                    {d.name}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
