/**
 * 勤怠CSVフォーマッター
 *
 * ビジネスロジック（どの日が出勤か）とは分離し、
 * 「出勤日のリスト → CSV文字列」への変換だけを担う。
 *
 * 出力形式（Shift_JIS変換は呼び出し元が行う）:
 *   #従業員コード*,名前*,...
 *   1030,生野,1,202603020900
 *   1030,生野,2,202603021930
 *   ...
 */

/** 1出勤日分のデータ */
export interface CsvWorkRow {
  /** YYYYMMDD 形式の日付 */
  dateStr: string;
  /** 出勤時刻（コロンなし HHmm 例: "0900"） */
  start: string;
  /** 退勤時刻（コロンなし HHmm 例: "1930"） */
  end: string;
}

/** 打刻CSVのコメントヘッダー（変更不要な固定文言） */
const CSV_HEADER_LINES = [
  '#従業員コード*,名前*(従業員コード、名前はどちらか必須),打刻種別コード*,打刻日時*',
  '#（注）*は必須項目です。最大登録数は1回あたり1000件です。,,,',
  '#先頭が#から始まる行は読み込まれません。最終行は改行で終了して下さい。また、下記サンプル行は削除してご使用下さい。,,,',
  '#「打刻種別コード」出勤1、退勤2,,,',
] as const;

/**
 * 出勤日リストから打刻CSVを生成する。
 *
 * @param empId   従業員コード（例: "1030"）
 * @param empName 従業員名（例: "生野"）
 * @param rows    出勤日ごとの { dateStr, start, end }
 * @returns       改行コード CRLF の CSV 文字列（最終行も CRLF で終わる）
 */
export function buildKintaiCsv(
  empId: string,
  empName: string,
  rows: CsvWorkRow[],
): string {
  const header = CSV_HEADER_LINES.join('\r\n') + '\r\n';

  const dataLines = rows.flatMap(({ dateStr, start, end }) => [
    `${empId},${empName},1,${dateStr}${start}`,
    `${empId},${empName},2,${dateStr}${end}`,
  ]);

  // データ行がない月（全休など）でもヘッダーだけ返す
  if (dataLines.length === 0) return header;

  return header + dataLines.join('\r\n') + '\r\n';
}
