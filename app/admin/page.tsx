'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DOCTOR_LIST } from '@/lib/constants';

// ── 型定義 ────────────────────────────────────────────────────────────

interface ConfirmSummary {
  workDays: number;
  extraDays: number;
  absentPaid: number;
  absentUnpaid: number;
  absentSub: number;
}

interface ConfirmEntry {
  empId: string;
  empName: string;
  year: number;
  month: number;
  confirmedAt: string;
  summary?: ConfirmSummary;
}

interface DoctorItem {
  id: string;
  name: string;
}

interface StatusData {
  confirmed: ConfirmEntry[];
  notConfirmed: DoctorItem[];
}

// ── ユーティリティ ────────────────────────────────────────────────────

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  return `${year}年${Number(month)}月`;
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // セッションストレージからキーを復元
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('admin_key');
    if (stored) {
      setAdminKey(stored);
      setIsAuthenticated(true);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  // 月一覧を取得
  const fetchMonths = useCallback(
    async (key: string) => {
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
          setAuthError('パスワードが正しくありません。');
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
    },
    [],
  );

  useEffect(() => {
    if (isAuthenticated && adminKey) {
      fetchMonths(adminKey);
    }
  }, [isAuthenticated, adminKey, fetchMonths]);

  // 選択月の提出状況を取得
  useEffect(() => {
    if (!selectedMonth || !isAuthenticated || !adminKey) return;

    const [year, month] = selectedMonth.split('-').map(Number);
    let cancelled = false;

    (async () => {
      setLoadingStatus(true);
      setError('');
      try {
        const res = await fetch(
          `/api/admin?action=status&year=${year}&month=${month}`,
          { headers: { 'X-Admin-Key': adminKey } },
        );
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

  // ログイン処理
  const handleLogin = useCallback(() => {
    const key = inputKey.trim();
    if (!key) return;
    setAuthError('');
    setAdminKey(key);
    sessionStorage.setItem('admin_key', key);
    setIsAuthenticated(true);
  }, [inputKey]);

  // ログアウト処理
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

  // CSV ダウンロード
  const handleCsvDownload = async (entry: ConfirmEntry) => {
    setDownloadingId(entry.empId);
    try {
      const res = await fetch(
        `/api/admin-csv?empId=${entry.empId}&year=${entry.year}&month=${entry.month}`,
        { headers: { 'X-Admin-Key': adminKey } },
      );
      if (!res.ok) {
        alert('CSVのダウンロードに失敗しました。');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename\*=UTF-8''(.+)/);
      const mm = String(entry.month).padStart(2, '0');
      const fallback = `${entry.year}${mm}_${entry.empId}_${entry.empName}.csv`;
      a.href = url;
      a.download = match ? decodeURIComponent(match[1]) : fallback;
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

  // 全員分まとめてダウンロード
  const handleDownloadAll = async () => {
    if (!statusData || statusData.confirmed.length === 0) return;
    for (const entry of statusData.confirmed) {
      await handleCsvDownload(entry);
      // ブラウザのダウンロードダイアログが連続しないよう少し待機
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const totalDoctors = DOCTOR_LIST.length;
  const confirmedCount = statusData?.confirmed.length ?? 0;
  const progressPercent =
    totalDoctors > 0 ? Math.round((confirmedCount / totalDoctors) * 100) : 0;

  // ── ログイン画面 ────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="スター歯科クリニック" className="w-16 h-16 rounded-2xl shadow-lg mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-800">勤怠管理ダッシュボード</h1>
            <p className="text-sm text-gray-400 mt-1">
              医療法人社団スター歯科クリニック
            </p>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl p-3 mb-4 flex items-center gap-2">
              <span>⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                管理パスワード
              </label>
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

          <p className="text-center text-xs text-gray-300 mt-6">
            事務専用管理画面
          </p>
        </div>
      </div>
    );
  }

  // ── ダッシュボード画面 ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="スター歯科クリニック" className="w-9 h-9 flex-shrink-0" />
            <div>
              <h1 className="text-sm font-bold text-gray-800 leading-tight">
                勤怠管理ダッシュボード
              </h1>
              <p className="text-xs text-gray-400">医療法人社団スター歯科クリニック</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ── 月選択 ─────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            対象月を選択
          </p>

          {loadingMonths ? (
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
              ))}
            </div>
          ) : months.length === 0 ? (
            <p className="text-sm text-gray-400">
              まだ確定データがありません。
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {months.map((m, idx) => (
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
                    <span
                      className={`text-xs rounded-full px-1.5 py-0.5 font-normal ${
                        selectedMonth === m
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 text-indigo-600'
                      }`}
                    >
                      最新
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── 提出状況 ─────────────────────────────────────────────────── */}
        {selectedMonth && (
          <section className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  {formatMonthLabel(selectedMonth)} 提出状況
                </h2>
                {!loadingStatus && statusData && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {statusData.confirmed.length}名 / {totalDoctors}名 確定済み
                  </p>
                )}
              </div>

              {!loadingStatus && statusData && statusData.confirmed.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingId !== null}
                  className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-2 hover:bg-indigo-100 disabled:opacity-50 transition-colors font-medium"
                >
                  <span>⬇</span>
                  全員CSV一括
                </button>
              )}
            </div>

            {loadingStatus ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-6 text-red-500 text-sm">{error}</div>
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

                {/* 確定済みリスト */}
                {statusData.confirmed.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-sm font-semibold text-emerald-700">
                        ✅ 確定済み
                      </span>
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-2 py-0.5">
                        {statusData.confirmed.length}名
                      </span>
                    </div>
                    <div className="space-y-2">
                      {statusData.confirmed.map((entry) => (
                        <div
                          key={entry.empId}
                          className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-800 text-sm">
                                {entry.empName}
                              </span>
                              <span className="text-xs text-gray-400">
                                ID: {entry.empId}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                              <span>確定: {formatDateTime(entry.confirmedAt)}</span>
                              {entry.summary && (
                                <span className="text-gray-600">
                                  出勤 <strong>{entry.summary.workDays}</strong>日
                                  {entry.summary.extraDays > 0 && (
                                    <span className="text-orange-600">
                                      （休日出勤 {entry.summary.extraDays}日）
                                    </span>
                                  )}
                                  {entry.summary.absentPaid > 0 && (
                                    <span className="ml-1">
                                      有給 {entry.summary.absentPaid}日
                                    </span>
                                  )}
                                  {entry.summary.absentUnpaid > 0 && (
                                    <span className="ml-1 text-red-500">
                                      欠勤 {entry.summary.absentUnpaid}日
                                    </span>
                                  )}
                                  {entry.summary.absentSub > 0 && (
                                    <span className="ml-1">
                                      振替 {entry.summary.absentSub}日
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleCsvDownload(entry)}
                            disabled={downloadingId !== null}
                            className="flex-shrink-0 flex items-center gap-1 text-xs bg-white text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 disabled:opacity-50 transition-colors font-medium whitespace-nowrap"
                          >
                            {downloadingId === entry.empId ? (
                              <span className="animate-spin">⟳</span>
                            ) : (
                              <span>⬇</span>
                            )}
                            CSV
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 未提出リスト */}
                {statusData.notConfirmed.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-sm font-semibold text-gray-500">
                        ⏳ 未提出
                      </span>
                      <span className="bg-gray-100 text-gray-500 text-xs font-bold rounded-full px-2 py-0.5">
                        {statusData.notConfirmed.length}名
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {statusData.notConfirmed.map((doctor) => (
                        <div
                          key={doctor.id}
                          className="bg-gray-100 text-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium"
                        >
                          {doctor.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {statusData.confirmed.length === 0 &&
                  statusData.notConfirmed.length === 0 && (
                    <p className="text-center text-gray-400 py-6 text-sm">
                      データがありません
                    </p>
                  )}
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
