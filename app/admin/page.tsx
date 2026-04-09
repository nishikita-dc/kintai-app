'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { DOCTOR_LIST } from '@/lib/constants';

// ── 型定義 ────────────────────────────────────────────────────────────

interface ConfirmSummary {
  workDays: number;
  extraDays: number;
  absentPaid: number;
  absentUnpaid: number;
  absentSub: number;
}

interface AbsentRecord {
  date: string;
  type: '有給' | '欠勤' | '振替休日' | '祝日';
  name?: string;
}

interface KintaiData {
  extraWorkDays: string[];
  absentRecords: AbsentRecord[];
  timeChanges: { date: string; inTime: string; outTime: string }[];
}

interface ConfirmEntry {
  empId: string;
  empName: string;
  year: number;
  month: number;
  confirmedAt: string;
  summary?: ConfirmSummary;
  kintai?: KintaiData;
  sentAt?: string;
}

interface DoctorItem { id: string; name: string }
interface StatusData { confirmed: ConfirmEntry[]; notConfirmed: DoctorItem[] }

// ── カレンダー日付タイプ ───────────────────────────────────────────────

type DayType = 'work' | 'extra' | 'paid' | 'unpaid' | 'sub_off' | 'holiday' | 'fixed_off' | 'empty';

interface CalendarDay { day: number | null; type: DayType; label?: string }

/** 指定年月の第nth曜日(dow)の日付を返す。dow: 0=日, 1=月, ..., 6=土 */
function nthWeekday(year: number, month: number, nth: number, dow: number): number {
  const firstDow = new Date(year, month - 1, 1).getDay();
  return 1 + ((dow - firstDow + 7) % 7) + 7 * (nth - 1);
}

function buildCalendar(entry: ConfirmEntry): CalendarDay[] {
  const { year, month, kintai } = entry;
  const daysInMonth = new Date(year, month, 0).getDate();
  // 月の1日の曜日（0=日〜6=土 → Mon-first に変換）
  const firstDow = new Date(year, month - 1, 1).getDay();
  const startDow = (firstDow + 6) % 7; // 0=月〜6=日

  // 日本の祝日（移動祝日はnthWeekdayで正確に計算）
  const holidayMap: Record<number, string> = {};
  if (month === 1)  { holidayMap[1] = '元日'; holidayMap[nthWeekday(year, 1, 2, 1)] = '成人の日'; }
  if (month === 2)  { holidayMap[11] = '建国記念の日'; holidayMap[23] = '天皇誕生日'; }
  if (month === 3)  { holidayMap[20] = '春分の日'; }
  if (month === 4)  { holidayMap[29] = '昭和の日'; }
  if (month === 5)  { holidayMap[3] = '憲法記念日'; holidayMap[4] = 'みどりの日'; holidayMap[5] = 'こどもの日'; }
  if (month === 7)  { holidayMap[nthWeekday(year, 7, 3, 1)] = '海の日'; }
  if (month === 8)  { holidayMap[11] = '山の日'; }
  if (month === 9)  { holidayMap[nthWeekday(year, 9, 3, 1)] = '敬老の日'; holidayMap[23] = '秋分の日'; }
  if (month === 10) { holidayMap[nthWeekday(year, 10, 2, 1)] = 'スポーツの日'; }
  if (month === 11) { holidayMap[3] = '文化の日'; holidayMap[23] = '勤労感謝の日'; }

  const extraSet = new Set(
    (kintai?.extraWorkDays ?? []).map((d) => Number(d.split('-')[2])),
  );
  // 同日に複数レコードがある場合は最初のものを優先（first-wins）
  const absentMap = new Map<number, AbsentRecord>();
  for (const r of (kintai?.absentRecords ?? [])) {
    const day = Number(r.date.split('-')[2]);
    if (!absentMap.has(day)) absentMap.set(day, r);
  }

  const days: CalendarDay[] = [];
  for (let i = 0; i < startDow; i++) days.push({ day: null, type: 'empty' });

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (startDow + d - 1) % 7; // 0=月〜6=日
    const isHoliday = d in holidayMap;
    const absent = absentMap.get(d);

    let type: DayType;
    let label: string | undefined;

    if (absent?.type === '有給')       { type = 'paid'; }
    else if (absent?.type === '欠勤')  { type = 'unpaid'; }
    else if (absent?.type === '振替休日') { type = 'sub_off'; }
    else if (absent?.type === '祝日')  { type = 'holiday'; label = absent.name; }
    else if (isHoliday)                { type = 'holiday'; label = holidayMap[d]; }
    else if (extraSet.has(d))          { type = 'extra'; }
    else if (dow === 0 || dow === 6)   { type = 'fixed_off'; } // 土日はデフォルト定休（概算）
    else                               { type = 'work'; }

    days.push({ day: d, type, label });
  }

  while (days.length % 7 !== 0) days.push({ day: null, type: 'empty' });
  return days;
}

// ── スタイルヘルパー ──────────────────────────────────────────────────

function dayTypeClass(type: DayType): string {
  switch (type) {
    case 'work':      return 'bg-indigo-100 text-indigo-700';
    case 'extra':     return 'bg-orange-100 text-orange-700 font-bold ring-1 ring-orange-300';
    case 'paid':      return 'bg-emerald-100 text-emerald-700';
    case 'unpaid':    return 'bg-red-100 text-red-700';
    case 'sub_off':   return 'bg-purple-100 text-purple-700';
    case 'holiday':   return 'bg-amber-100 text-amber-700';
    case 'fixed_off': return 'bg-gray-100 text-gray-400';
    default:          return '';
  }
}

function eventIcon(type: string): string {
  switch (type) {
    case 'extra':     return '🔄';
    case '有給':       return '🌿';
    case '欠勤':       return '⚠️';
    case '振替休日':   return '🔁';
    case '祝日':       return '🎌';
    default:          return '📅';
  }
}

function eventBadgeClass(type: string): string {
  switch (type) {
    case 'extra':     return 'bg-orange-50 text-orange-700 border-orange-200';
    case '有給':       return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case '欠勤':       return 'bg-red-50 text-red-700 border-red-200';
    case '振替休日':   return 'bg-purple-50 text-purple-700 border-purple-200';
    case '祝日':       return 'bg-amber-50 text-amber-700 border-amber-200';
    default:          return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${y}年${Number(mo)}月`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── ミニカレンダー ────────────────────────────────────────────────────

const MiniCalendar = memo(function MiniCalendar({ days }: { days: CalendarDay[] }) {
  const DOW_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DOW_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 6 ? 'text-red-400' : i === 5 ? 'text-blue-400' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
          {week.map((cell, ci) => (
            <div
              key={ci}
              className={`h-8 flex flex-col items-center justify-center rounded text-xs ${cell.type === 'empty' ? '' : dayTypeClass(cell.type)}`}
              title={cell.label}
            >
              {cell.day !== null && <span>{cell.day}</span>}
            </div>
          ))}
        </div>
      ))}
      {/* 凡例 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-gray-200">
        {([
          ['work',      '出勤',    'bg-indigo-100'],
          ['extra',     '振替出勤', 'bg-orange-100'],
          ['paid',      '有給',    'bg-emerald-100'],
          ['unpaid',    '欠勤',    'bg-red-100'],
          ['sub_off',   '振替休日', 'bg-purple-100'],
          ['holiday',   '祝日',    'bg-amber-100'],
          ['fixed_off', '定休',    'bg-gray-100'],
        ] as [DayType, string, string][]).map(([, label, bg]) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${bg}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── ドクターカード ────────────────────────────────────────────────────

/** 確定日が月の前半（15日以前）かどうか */
function isEarlyConfirm(confirmedAt: string, year: number, month: number): boolean {
  const confirmed = new Date(confirmedAt);
  const jstDay = new Date(confirmed.getTime() + 9 * 60 * 60 * 1000).getUTCDate();
  const jstMonth = new Date(confirmed.getTime() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  const jstYear = new Date(confirmed.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear();
  // 対象月の15日以前に確定されているか
  return jstYear === year && jstMonth === month && jstDay <= 15;
}

const DoctorCard = memo(function DoctorCard({
  entry, isOpen, onToggle, onCsvDownload, isDownloading,
}: {
  entry: ConfirmEntry;
  isOpen: boolean;
  onToggle: () => void;
  onCsvDownload: () => void;
  isDownloading: boolean;
}) {
  const { summary, kintai, sentAt } = entry;
  const earlyConfirm = !sentAt && isEarlyConfirm(entry.confirmedAt, entry.year, entry.month);

  const calendarDays = useMemo(
    () => (isOpen ? buildCalendar(entry) : []),
    [isOpen, entry],
  );

  const events = useMemo(() => {
    if (!kintai) return [];
    const out: { date: string; type: string; label: string }[] = [];
    for (const d of kintai.extraWorkDays) {
      out.push({ date: d.slice(5).replace('-', '/'), type: 'extra', label: '振替出勤（休日出勤）' });
    }
    for (const r of kintai.absentRecords) {
      out.push({ date: r.date.slice(5).replace('-', '/'), type: r.type, label: r.type + (r.name ? `（${r.name}）` : '') });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [kintai]);

  const panelId = `doctor-panel-${entry.empId}`;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isOpen ? 'border-indigo-300 shadow-md' : 'border-gray-200'}`}>
      {/* ヘッダー行: ボタン入れ子を解消しトグルとCSVを独立したボタンに分割 */}
      <div className="flex items-center bg-white hover:bg-gray-50 transition-colors">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex flex-1 items-center gap-3 px-4 py-3 text-left min-w-0"
        >
          <span aria-hidden="true" className={`text-gray-400 text-sm transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-800">{entry.empName}</span>
              <span className="text-xs text-gray-400">ID: {entry.empId}</span>
              {sentAt ? (
                <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">
                  <span aria-hidden="true">📧</span> 送信済み {formatDateTime(sentAt)}
                </span>
              ) : (
                <span className="text-xs text-gray-400">確定: {formatDateTime(entry.confirmedAt)}</span>
              )}
              {earlyConfirm && (
                <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">
                  <span aria-hidden="true">⚠️</span> 月前半確定 — 変更の可能性あり
                </span>
              )}
            </div>
            {summary && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs">
                <span className="text-indigo-600">
                  出勤 <strong>{summary.workDays}</strong>日
                  {summary.extraDays > 0 && <span className="text-orange-500">（振替出勤 {summary.extraDays}日含む）</span>}
                </span>
                {summary.absentPaid > 0   && <span className="text-emerald-600">有給 <strong>{summary.absentPaid}</strong>日</span>}
                {summary.absentUnpaid > 0 && <span className="text-red-500">欠勤 <strong>{summary.absentUnpaid}</strong>日</span>}
                {summary.absentSub > 0    && <span className="text-purple-600">振替休日 <strong>{summary.absentSub}</strong>日</span>}
              </div>
            )}
          </div>
        </button>
        <div className="flex-shrink-0 pr-4">
          <button
            type="button"
            onClick={onCsvDownload}
            disabled={isDownloading}
            className="flex items-center gap-1 text-xs bg-white text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 disabled:opacity-50 transition-colors font-medium"
          >
            {isDownloading ? <span aria-hidden="true" className="animate-spin inline-block">⟳</span> : <span aria-hidden="true">⬇</span>}
            CSV
          </button>
        </div>
      </div>

      {/* 展開エリア */}
      {isOpen && (
        <div id={panelId} className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-5">
          {/* カレンダー */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {entry.year}年{entry.month}月 カレンダー
            </p>
            <MiniCalendar days={calendarDays} />
          </div>

          {/* 特記事項 */}
          {events.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">特記事項</p>
              <div className="space-y-1.5">
                {events.map((ev, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${eventBadgeClass(ev.type)}`}>
                    <span aria-hidden="true">{eventIcon(ev.type)}</span>
                    <span className="font-semibold">{ev.date}</span>
                    <span>{ev.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!kintai && (
            <p className="text-xs text-gray-400 text-center py-2">詳細データなし（旧フォーマット）</p>
          )}
        </div>
      )}
    </div>
  );
});

// ── メインページ ──────────────────────────────────────────────────────

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string>('');
  const [inputKey, setInputKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loadingMonths, setLoadingMonths] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [openDoctorId, setOpenDoctorId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Dr管理
  const [customDoctors, setCustomDoctors] = useState<DoctorItem[]>(DOCTOR_LIST);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [savingDoctors, setSavingDoctors] = useState(false);
  const [doctorSaveError, setDoctorSaveError] = useState<string>('');
  const [isManagingDoctors, setIsManagingDoctors] = useState(false);
  const [editDoctorIdx, setEditDoctorIdx] = useState<number | null>(null);
  const [editDoctorForm, setEditDoctorForm] = useState({ id: '', name: '' });
  const [isAddingDoctor, setIsAddingDoctor] = useState(false);
  const [newDoctorForm, setNewDoctorForm] = useState({ id: '', name: '' });

  const inputRef = useRef<HTMLInputElement>(null);

  // 月一覧を取得（セッション復元時に使用）
  const fetchMonths = useCallback(async (key: string) => {
    setLoadingMonths(true);
    setError('');
    try {
      const res = await fetch('/api/admin?action=months', {
        headers: { 'X-Admin-Key': key },
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        setAdminKey('');
        sessionStorage.removeItem('admin_key');
        setAuthError('セッションが切れました。再度ログインしてください。');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { months: string[] };
      const list = data.months ?? [];
      setMonths(list);
      if (list.length > 0) setSelectedMonth(list[0]);
    } catch {
      setError('月一覧の取得に失敗しました。接続を確認してください。');
    } finally {
      setLoadingMonths(false);
    }
  }, []);

  // セッションストレージからキーを復元し、月一覧を取得
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('admin_key');
    if (stored) {
      setAdminKey(stored);
      setIsAuthenticated(true);
      fetchMonths(stored);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 認証後にKVからDrリストを取得
  useEffect(() => {
    if (!isAuthenticated || !adminKey) return;
    setLoadingDoctors(true);
    fetch('/api/admin?action=doctors', { headers: { 'X-Admin-Key': adminKey } })
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { doctors?: DoctorItem[] };
        if (d.doctors) setCustomDoctors(d.doctors);
      })
      .catch((err) => { console.error('Dr一覧の取得に失敗しました:', err); })
      .finally(() => setLoadingDoctors(false));
  }, [isAuthenticated, adminKey]);

  // 選択月の提出状況を取得
  useEffect(() => {
    if (!selectedMonth || !isAuthenticated || !adminKey) return;
    const [year, month] = selectedMonth.split('-').map(Number);
    let cancelled = false;

    (async () => {
      setLoadingStatus(true);
      setError('');
      setOpenDoctorId(null);
      try {
        const res = await fetch(
          `/api/admin?action=status&year=${year}&month=${month}`,
          { headers: { 'X-Admin-Key': adminKey } },
        );
        if (res.status === 401) {
          if (!cancelled) {
            setIsAuthenticated(false);
            setAdminKey('');
            sessionStorage.removeItem('admin_key');
            setAuthError('セッションが切れました。再度ログインしてください。');
          }
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as StatusData;
        if (!cancelled) setStatusData(data);
      } catch {
        if (!cancelled) setError('データの取得に失敗しました。');
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedMonth, isAuthenticated, adminKey]);

  // ── Dr管理ハンドラ ──────────────────────────────────────────────

  const saveDoctors = useCallback(async (doctors: DoctorItem[]) => {
    setSavingDoctors(true);
    setDoctorSaveError('');
    try {
      const res = await fetch('/api/admin?action=saveDoctors', {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(doctors),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCustomDoctors(doctors);
    } catch {
      setDoctorSaveError('保存に失敗しました。再度お試しください。');
    } finally {
      setSavingDoctors(false);
    }
  }, [adminKey]);

  const handleStartEditDoctor = (idx: number) => {
    setEditDoctorIdx(idx);
    setEditDoctorForm({ id: customDoctors[idx].id, name: customDoctors[idx].name });
  };

  const handleSaveEditDoctor = () => {
    if (!editDoctorForm.id.trim() || !editDoctorForm.name.trim() || editDoctorIdx === null) return;
    const updated = customDoctors.map((d, i) =>
      i === editDoctorIdx ? { id: editDoctorForm.id.trim(), name: editDoctorForm.name.trim() } : d,
    );
    saveDoctors(updated);
    setEditDoctorIdx(null);
  };

  const handleDeleteDoctor = (idx: number) => {
    if (!confirm(`「${customDoctors[idx].name}」を削除しますか？`)) return;
    saveDoctors(customDoctors.filter((_, i) => i !== idx));
  };

  const handleAddDoctor = () => {
    if (!newDoctorForm.id.trim() || !newDoctorForm.name.trim()) return;
    saveDoctors([...customDoctors, { id: newDoctorForm.id.trim(), name: newDoctorForm.name.trim() }]);
    setNewDoctorForm({ id: '', name: '' });
    setIsAddingDoctor(false);
  };

  const handleResetDoctors = () => {
    if (!confirm('Dr一覧をデフォルト（初期設定）に戻しますか？')) return;
    saveDoctors(DOCTOR_LIST);
    setEditDoctorIdx(null);
    setIsAddingDoctor(false);
  };

  // ── ログイン / ログアウト ───────────────────────────────────────────

  const handleLogin = useCallback(async () => {
    const key = inputKey.trim();
    if (!key) return;
    setAuthError('');
    setLoadingMonths(true);
    try {
      const res = await fetch('/api/admin?action=months', {
        headers: { 'X-Admin-Key': key },
      });
      if (res.status === 401) {
        setAuthError('パスワードが正しくありません。');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { months: string[] };
      const list = data.months ?? [];
      setMonths(list);
      if (list.length > 0) setSelectedMonth(list[0]);
      sessionStorage.setItem('admin_key', key);
      setAdminKey(key);
      setIsAuthenticated(true);
    } catch {
      setAuthError('接続に失敗しました。再度お試しください。');
    } finally {
      setLoadingMonths(false);
    }
  }, [inputKey]);

  const handleLogout = () => {
    setAdminKey('');
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_key');
    setMonths([]);
    setSelectedMonth('');
    setStatusData(null);
    setInputKey('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCsvDownload = async (entry: ConfirmEntry) => {
    setDownloadingId(entry.empId);
    try {
      const res = await fetch(
        `/api/admin-csv?empId=${entry.empId}&year=${entry.year}&month=${entry.month}`,
        { headers: { 'X-Admin-Key': adminKey } },
      );
      if (!res.ok) { alert('CSVのダウンロードに失敗しました。'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disp = res.headers.get('content-disposition') ?? '';
      const match = disp.match(/filename\*=UTF-8''(.+)/);
      const mm = String(entry.month).padStart(2, '0');
      a.href = url;
      a.download = match ? decodeURIComponent(match[1]) : `${entry.year}${mm}_${entry.empId}_${entry.empName}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('CSVのダウンロード中にエラーが発生しました。');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!statusData || statusData.confirmed.length === 0) return;
    for (const entry of statusData.confirmed) {
      await handleCsvDownload(entry);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const totalDoctors = customDoctors.length;
  const confirmedCount = statusData?.confirmed.length ?? 0;
  const notConfirmedList = statusData?.notConfirmed ?? [];
  const progressPercent = totalDoctors > 0 ? Math.round((confirmedCount / totalDoctors) * 100) : 0;

  // ── ログイン画面 ────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="スター歯科クリニック" className="w-16 h-16 rounded-2xl shadow-lg mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-800">勤怠管理ダッシュボード</h1>
            <p className="text-sm text-gray-400 mt-1">医療法人社団スター歯科クリニック</p>
          </div>
          {authError && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl p-3 mb-4 flex items-center gap-2" role="alert">
              <span aria-hidden="true">⚠️</span><span>{authError}</span>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">管理パスワード</label>
              <input
                ref={inputRef}
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="パスワードを入力"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition"
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={!inputKey.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ログイン
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">事務専用管理画面</p>
        </div>
      </div>
    );
  }

  // ── ダッシュボード ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="スター歯科クリニック" className="w-9 h-9 flex-shrink-0" />
            <div>
              <h1 className="text-sm font-bold text-gray-800 leading-tight">勤怠管理ダッシュボード</h1>
              <p className="text-xs text-gray-400">医療法人社団スター歯科クリニック</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <a href="/admin/mockup/" className="text-xs text-gray-400 hover:text-indigo-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-indigo-300 transition-colors">
              モック
            </a>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-gray-300 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Dr一覧管理 */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setIsManagingDoctors(!isManagingDoctors)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700"><span aria-hidden="true">⚙</span> Dr一覧管理</span>
              {loadingDoctors
                ? <span className="text-xs text-gray-400 animate-pulse">読み込み中...</span>
                : <span className="text-xs text-gray-400">{customDoctors.length}名</span>
              }
              {savingDoctors && (
                <span className="text-xs bg-indigo-50 text-indigo-500 border border-indigo-100 rounded-full px-2 py-0.5 animate-pulse">
                  保存中...
                </span>
              )}
            </div>
            <span className={`text-gray-400 text-sm transition-transform duration-200 ${isManagingDoctors ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {isManagingDoctors && (
            <div className="border-t border-gray-100 px-5 py-4 space-y-3">
              <p className="text-xs text-gray-400">
                ここで編集した内容はすぐにアプリに反映されます。
              </p>

              {/* Dr一覧 */}
              <div className="space-y-1.5">
                {customDoctors.map((doctor, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 bg-gray-50">
                    {editDoctorIdx === idx ? (
                      <>
                        <input
                          type="text"
                          value={editDoctorForm.id}
                          onChange={(e) => setEditDoctorForm((f) => ({ ...f, id: e.target.value }))}
                          placeholder="従業員番号"
                          className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <input
                          type="text"
                          value={editDoctorForm.name}
                          onChange={(e) => setEditDoctorForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="名前"
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEditDoctor()}
                        />
                        <button
                          onClick={handleSaveEditDoctor}
                          className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1 hover:bg-indigo-700 transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditDoctorIdx(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400 w-16 flex-shrink-0 font-mono">{doctor.id}</span>
                        <span className="flex-1 text-sm font-medium text-gray-700">{doctor.name}</span>
                        <button
                          onClick={() => handleStartEditDoctor(idx)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-100 rounded-lg px-2.5 py-1 hover:border-indigo-300 transition-colors"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDeleteDoctor(idx)}
                          className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2.5 py-1 hover:border-red-300 transition-colors"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* 追加フォーム */}
              {isAddingDoctor ? (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-indigo-100 bg-indigo-50">
                  <input
                    type="text"
                    value={newDoctorForm.id}
                    onChange={(e) => setNewDoctorForm((f) => ({ ...f, id: e.target.value }))}
                    placeholder="従業員番号"
                    className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <input
                    type="text"
                    value={newDoctorForm.name}
                    onChange={(e) => setNewDoctorForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="名前（例: 山本）"
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDoctor()}
                  />
                  <button
                    onClick={handleAddDoctor}
                    disabled={!newDoctorForm.id.trim() || !newDoctorForm.name.trim()}
                    className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1 hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                  >
                    追加
                  </button>
                  <button
                    onClick={() => { setIsAddingDoctor(false); setNewDoctorForm({ id: '', name: '' }); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingDoctor(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-600 border border-dashed border-indigo-200 rounded-xl py-2.5 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  ＋ Drを追加
                </button>
              )}

              {/* リセット */}
              <button
                onClick={handleResetDoctors}
                disabled={savingDoctors}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2 disabled:opacity-40"
              >
                初期設定に戻す
              </button>

              {/* 保存エラー表示 */}
              {doctorSaveError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-3 py-2">
                  <span aria-hidden="true">⚠️</span>
                  <span>{doctorSaveError}</span>
                  <button
                    onClick={() => setDoctorSaveError('')}
                    className="ml-auto text-red-400 hover:text-red-600"
                    aria-label="エラーを閉じる"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ガイド・リンク */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">ガイド・リンク</p>

          <div className="grid sm:grid-cols-2 gap-2">
            <a
              href="https://diagram-kintai-admin-guide.surge.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-3 rounded-xl border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 transition-colors group"
            >
              <span className="w-8 h-8 bg-indigo-200 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-300 transition-colors" aria-hidden="true">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </span>
              <div>
                <p className="text-xs font-bold text-indigo-800">ダッシュボードの使い方</p>
                <p className="text-[10px] text-indigo-500">自動送信の仕組み・Dr管理</p>
              </div>
            </a>

            <a
              href="https://diagram-kintai-guide.surge.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-3 rounded-xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 transition-colors group"
            >
              <span className="w-8 h-8 bg-emerald-200 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-300 transition-colors" aria-hidden="true">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </span>
              <div>
                <p className="text-xs font-bold text-emerald-800">Dr向けアプリの使い方</p>
                <p className="text-[10px] text-emerald-500">新人Drへの案内用</p>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50">
            <span className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-700">アプリURL（新人Dr共有用）</p>
              <p className="text-[10px] text-gray-400 font-mono truncate">https://kintai-app-dyu.pages.dev</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText('https://kintai-app-dyu.pages.dev');
                const btn = document.getElementById('copy-url-btn');
                if (btn) { btn.textContent = 'コピー済み'; setTimeout(() => { btn.textContent = 'コピー'; }, 2000); }
              }}
              id="copy-url-btn"
              className="text-xs bg-white text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 hover:border-gray-300 transition-colors font-medium flex-shrink-0"
            >
              コピー
            </button>
          </div>
        </section>

        {/* 月選択 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">対象月を選択</p>
          {loadingMonths ? (
            <div className="h-10 w-56 bg-gray-100 rounded-xl animate-pulse" />
          ) : months.length === 0 ? (
            <p className="text-sm text-gray-400">まだ確定データがありません。</p>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent cursor-pointer shadow-sm"
                >
                  {/* 年ごとに optgroup でグルーピング */}
                  {Array.from(new Set(months.map((m) => m.slice(0, 4))))
                    .sort((a, b) => b.localeCompare(a))
                    .map((year) => (
                      <optgroup key={year} label={`${year}年`}>
                        {months
                          .filter((m) => m.startsWith(year))
                          .map((m, idx, arr) => {
                            const isLatest = m === months[0];
                            return (
                              <option key={m} value={m}>
                                {formatMonthLabel(m)}{isLatest ? '　★最新' : ''}
                              </option>
                            );
                          })}
                      </optgroup>
                    ))}
                </select>
                {/* ドロップダウン矢印 */}
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {selectedMonth === months[0] && (
                <span className="text-xs bg-indigo-100 text-indigo-600 rounded-full px-2.5 py-1 font-medium">
                  最新月
                </span>
              )}
            </div>
          )}
        </section>

        {/* 提出状況 */}
        {selectedMonth && (
          <section className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-800">{formatMonthLabel(selectedMonth)} 提出状況</h2>
                {!loadingStatus && statusData && (
                  <p className="text-xs text-gray-400 mt-0.5">{statusData.confirmed.length}名 / {totalDoctors}名 確定済み</p>
                )}
              </div>
              {!loadingStatus && statusData && statusData.confirmed.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingId !== null}
                  className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-2 hover:bg-indigo-100 disabled:opacity-50 transition-colors font-medium"
                >
                  ⬇ 全員CSV一括
                </button>
              )}
            </div>

            {loadingStatus ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : error ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-red-500 text-sm">{error}</p>
                <button
                  onClick={() => setSelectedMonth((m) => m)}
                  className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-4 py-2 hover:bg-indigo-50 transition-colors"
                >
                  再読み込み
                </button>
              </div>
            ) : statusData ? (
              <div className="space-y-5">
                {/* プログレスバー */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>提出率</span>
                    <span className="font-semibold text-indigo-600">{progressPercent}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* 確定済み */}
                {statusData.confirmed.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-sm font-semibold text-emerald-700"><span aria-hidden="true">✅</span> 確定済み</span>
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-2 py-0.5">
                        {statusData.confirmed.length}名
                      </span>
                    </div>
                    <div className="space-y-2">
                      {statusData.confirmed.map((entry) => (
                        <DoctorCard
                          key={entry.empId}
                          entry={entry}
                          isOpen={openDoctorId === entry.empId}
                          onToggle={() => setOpenDoctorId(openDoctorId === entry.empId ? null : entry.empId)}
                          onCsvDownload={() => handleCsvDownload(entry)}
                          isDownloading={downloadingId === entry.empId}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 未提出 */}
                {notConfirmedList.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-sm font-semibold text-gray-500"><span aria-hidden="true">⏳</span> 未提出</span>
                      <span className="bg-gray-100 text-gray-500 text-xs font-bold rounded-full px-2 py-0.5">
                        {notConfirmedList.length}名
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {notConfirmedList.map((doctor) => (
                        <div key={doctor.id} className="bg-gray-100 text-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium">
                          {doctor.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {statusData.confirmed.length === 0 && statusData.notConfirmed.length === 0 && (
                  <p className="text-center text-gray-400 py-6 text-sm">データがありません</p>
                )}
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
