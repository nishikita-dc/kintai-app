'use client';

import { useState } from 'react';
import type { PreviewRow, Summary } from '@/types';
import { ADMIN_NAME } from '@/lib/constants';

interface PreviewTableProps {
  previewData: PreviewRow[];
  summary: Summary;
  generatedCsv: string | null;
  year: number;
  month: number;
  empId: string;
  empName: string;
  onDownload: () => void;
  // 確定フロー
  onConfirm?: () => void;
  isConfirming?: boolean;
  isConfirmed?: boolean;
  confirmedAt?: string;
  onCancelConfirm?: () => void;
  // 即時送信
  onSendNow?: () => void;
  isSending?: boolean;
  sendResult?: { ok: boolean; message: string } | null;
}

/** 対象月の末日を返す（例: 2026年4月 → 30） */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function typeClass(row: PreviewRow): string {
  if (row.type === '通常') return 'border-slate-200 text-slate-500';
  if (row.isSubstitute) return 'border-brand-500 bg-brand-50 text-brand-600 font-bold';
  if (row.type === '有給') return 'border-emerald-200 bg-emerald-50 text-emerald-600';
  if (row.type === '欠勤') return 'border-red-200 bg-red-50 text-red-600';
  if (row.type === '振替休日') return 'border-blue-200 bg-blue-50 text-blue-600';
  if (row.type.includes('祝日')) return 'border-red-200 bg-red-50 text-red-600';
  if (row.type === '時間変更') return 'border-purple-200 bg-purple-50 text-purple-600';
  return 'border-orange-200 bg-orange-50 text-orange-600';
}

export default function PreviewTable({
  previewData,
  summary,
  generatedCsv,
  year,
  month,
  empId,
  empName,
  onDownload,
  onConfirm,
  isConfirming = false,
  isConfirmed = false,
  confirmedAt,
  onCancelConfirm,
  onSendNow,
  isSending = false,
  sendResult,
}: PreviewTableProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  return (
    <div className="mt-8 bg-white p-6 rounded-xl shadow-lg border border-brand-100 animation-fade-in relative">
      <h3 className="font-bold text-slate-700 mb-4 flex justify-between items-center border-b pb-3">
        <span className="flex items-center gap-2">
          <i className="fa-solid fa-table-list text-brand-500" />
          作成結果プレビュー
        </span>
      </h3>

      {/* 集計サマリ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-center">
          <div className="text-xs text-brand-500 font-bold mb-1">出勤日数</div>
          <div className="text-2xl font-bold text-brand-700">
            {summary.workDays}
            <span className="text-sm ml-1">日</span>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
          <div className="text-xs text-orange-500 font-bold mb-1">休日出勤</div>
          <div className="text-2xl font-bold text-orange-700">
            {summary.extraDays}
            <span className="text-sm ml-1">日</span>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 col-span-2">
          <div className="flex justify-between items-end mb-2 border-b border-slate-200 pb-1">
            <div className="text-xs text-slate-500 font-bold">お休み合計</div>
            <div className="text-xl font-bold text-slate-700">
              {summary.absentTotal}
              <span className="text-sm ml-1">日</span>
            </div>
          </div>
          <div className="flex justify-between gap-2 text-xs">
            <div className="text-center flex-1 bg-white rounded border border-emerald-100 p-1">
              <div className="text-emerald-500 font-bold">有給</div>
              <div>{summary.absentPaid}日</div>
            </div>
            <div className="text-center flex-1 bg-white rounded border border-blue-100 p-1">
              <div className="text-blue-500 font-bold">振替</div>
              <div>{summary.absentSub}日</div>
            </div>
            <div className="text-center flex-1 bg-white rounded border border-red-100 p-1">
              <div className="text-red-500 font-bold">欠勤</div>
              <div>{summary.absentUnpaid}日</div>
            </div>
          </div>
        </div>
      </div>

      {/* プレビューテーブル */}
      <div className="overflow-hidden border border-slate-200 rounded-lg mb-6">
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                {['日付', '曜日', '区分', '出勤', '退勤'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {previewData.map((row, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-slate-50 transition ${row.type !== '通常' ? 'bg-yellow-50/50' : ''}`}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{row.date}</td>
                  <td
                    className={`px-4 py-2.5 whitespace-nowrap font-bold ${
                      row.weekIdx === 0
                        ? 'text-red-500'
                        : row.weekIdx === 6
                          ? 'text-blue-500'
                          : 'text-slate-600'
                    }`}
                  >
                    {row.week}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${typeClass(row)}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-700">
                    {row.in}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-700">
                    {row.out}
                  </td>
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

          {/* ── 主アクション：確定して送信予約 ── */}
          {isConfirmed ? (
            /* 確定済みバナー */
            <div className="bg-green-500 rounded-xl px-5 py-4 flex items-start gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fa-solid fa-circle-check text-white text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">
                  {year}年{month}月分を確定しました
                </p>
                {confirmedAt && (
                  <p className="text-xs text-green-100 mt-0.5">確定日時: {confirmedAt}</p>
                )}
                <p className="text-xs text-green-100 mt-0.5">
                  自動送信予定: {year}年{month}月{lastDayOfMonth(year, month)}日 20:00 → {ADMIN_NAME}
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
                  {/* 今すぐ送信ボタン */}
                  {onSendNow && (
                    <button
                      onClick={onSendNow}
                      disabled={isSending}
                      className="inline-flex items-center gap-1.5 text-xs font-bold border border-white/50 text-white bg-white/20 hover:bg-white/30 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 transition"
                    >
                      {isSending ? (
                        <><i className="fa-solid fa-spinner fa-spin" /> 送信中...</>
                      ) : (
                        <><i className="fa-solid fa-paper-plane" /> 今すぐ送信</>
                      )}
                    </button>
                  )}
                  {onCancelConfirm && (
                    <button
                      onClick={() => setShowCancelDialog(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold border border-white/50 text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition"
                    >
                      <i className="fa-solid fa-rotate-left" />
                      確定を取り消して再編集する
                    </button>
                  )}
                </div>

                {/* 送信結果 */}
                {sendResult && (
                  <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${sendResult.ok ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                    <i className={`fa-solid ${sendResult.ok ? 'fa-check-circle' : 'fa-circle-exclamation'} mr-1`} />
                    {sendResult.message}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 確定ボタン */
            <button
              onClick={onConfirm}
              disabled={!generatedCsv || isConfirming}
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
          )}

          {/* 自動送信の案内（確定前のみ表示） */}
          {!isConfirmed && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mt-0.5">
                <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800">{month}月{lastDayOfMonth(year, month)}日 20:00 に自動送信されます</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  確定すると{ADMIN_NAME}へCSVが自動送信されます。確定後も「今すぐ送信」で即時送信もできます。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── 副アクション：CSVダウンロード ── */}
        <div className="bg-white px-5 py-3 border-t border-brand-100 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400 font-mono truncate min-w-0">
            {year}{String(month).padStart(2, '0')}_{empId}_{empName}.csv
          </p>
          <button
            onClick={onDownload}
            disabled={!generatedCsv}
            className="flex-shrink-0 text-sm border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2"
          >
            <i className="fa-solid fa-file-csv text-green-600" />
            CSVを保存
          </button>
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
                onClick={() => { setShowCancelDialog(false); onCancelConfirm?.(); }}
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
