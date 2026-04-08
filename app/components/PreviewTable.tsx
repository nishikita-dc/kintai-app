'use client';

import type { PreviewRow, Summary } from '@/types';

interface PreviewTableProps {
  previewData: PreviewRow[];
  summary: Summary;
  generatedCsv: string | null;
  year: number;
  month: number;
  empId: string;
  empName: string;
  onDownload: () => void;
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
}: PreviewTableProps) {
  return (
    <div className="mt-8 bg-white p-6 rounded-xl shadow-lg border border-brand-100 animation-fade-in">
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

      {/* ダウンロード */}
      <div className="bg-brand-50 p-5 rounded-xl text-center border border-brand-100">
        <p className="text-sm text-brand-800 mb-4 font-bold">
          内容を確認して問題なければダウンロードしてください
        </p>
        <button
          onClick={onDownload}
          disabled={!generatedCsv}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-2 mx-auto"
        >
          <i className="fa-solid fa-file-csv" />
          CSVファイルを保存する
        </button>
        <p className="text-xs text-brand-400 mt-3 font-mono">
          ファイル名: {year}
          {String(month).padStart(2, '0')}_{empId}_{empName}.csv
        </p>
      </div>
    </div>
  );
}
