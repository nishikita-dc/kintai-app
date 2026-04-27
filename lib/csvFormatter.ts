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

/**
 * Numbers テンプレート準拠のコメントヘッダー。
 * `public/template_timerecord.csv` と完全一致させる（SSOT）。
 */
const CSV_HEADER_LINES = [
  '#従業員コード*,名前*(従業員コード、名前はどちらか必須),打刻種別コード*,打刻日時*',
  '#（注）*は必須項目です。最大登録数は1回あたり1000件です。,,,',
  '#先頭が#から始まる行は読み込まれません。最終行は改行で終了して下さい。,,,',
] as const;

/**
 * 過去テンプレートに含まれていたが現在は使わないコメント行。
 * 既存KVに保存済みのCSVに当行のみ含まれているケースがあるため、
 * 正規化時に除去して新テンプレートに揃える。
 */
const LEGACY_HEADER_LINES: readonly string[] = [
  '#「打刻種別コード」出勤1、退勤2,,,',
];

/**
 * 旧テンプレートのコメント行を現テンプレート行に置き換えるマップ。
 * 過去に保存されたCSVをダウンロード時に正規化するために使う。
 */
const LEGACY_HEADER_LINE_REPLACEMENTS: Record<string, string> = {
  '#先頭が#から始まる行は読み込まれません。最終行は改行で終了して下さい。また、下記サンプル行は削除してご使用下さい。,,,':
    '#先頭が#から始まる行は読み込まれません。最終行は改行で終了して下さい。,,,',
};

const CRLF = '\r\n';
const HEADER = CSV_HEADER_LINES.join(CRLF) + CRLF;

function escapeCsvField(value: string): string {
  return /[,"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * 改行コードと末尾改行を固定し、同一入力で同一バイト列になるよう正規化する。
 * 過去テンプレートに由来する LEGACY_HEADER_LINES も合わせて除去するため、
 * 旧データ・新データのどちらを通しても出力テンプレートは一致する。
 */
export function normalizeKintaiCsv(csv: string): string {
  // 先頭BOM(U+FEFF)を除去。BOMが残ると King of Time が
  // 先頭 # コメント行のスキップ判定に失敗する。
  const withoutBom = csv.replace(/^﻿/, '');
  const normalized = withoutBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  // 末尾の空行は 1 行だけにする（最後は必ず CRLF で終える）
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  // 旧テンプレート由来のコメント行を除去（データ行は # で始まらないので影響なし）
  const cleaned = lines.filter((line) => !LEGACY_HEADER_LINES.includes(line));

  // 旧コメント行を新テンプレートのコメント行に置き換える
  const migrated = cleaned.map((line) => LEGACY_HEADER_LINE_REPLACEMENTS[line] ?? line);

  return migrated.join(CRLF) + CRLF;
}

/**
 * テンプレート準拠の勤怠CSVかを判定する。
 * false の場合、reason に失敗理由を返す。
 */
export function validateKintaiCsv(csv: string): { ok: true } | { ok: false; reason: string } {
  if (!csv.endsWith(CRLF)) {
    return { ok: false, reason: 'CSVの最終行はCRLFで終了している必要があります。' };
  }
  if (csv.includes('\n') && csv.includes('\r\n') === false) {
    return { ok: false, reason: '改行コードはCRLF固定です。' };
  }

  const rows = csv.split(CRLF);
  // split の都合で最後に空文字が1行できる
  if (rows[rows.length - 1] === '') rows.pop();

  if (rows.length < CSV_HEADER_LINES.length) {
    return { ok: false, reason: 'ヘッダー行が不足しています。' };
  }

  for (let i = 0; i < CSV_HEADER_LINES.length; i += 1) {
    if (rows[i] !== CSV_HEADER_LINES[i]) {
      return { ok: false, reason: `ヘッダー${i + 1}行目がテンプレートと一致しません。` };
    }
  }

  const dataRows = rows.slice(CSV_HEADER_LINES.length);
  const dataLinePattern = /^([^,\r\n]+|"(?:""|[^"])*"),([^,\r\n]+|"(?:""|[^"])*"),([12]),(\d{12})$/;
  for (const line of dataRows) {
    if (line.startsWith('#')) {
      return { ok: false, reason: 'データ行にコメント行が含まれています。' };
    }
    if (!dataLinePattern.test(line)) {
      return { ok: false, reason: `不正なデータ行です: ${line}` };
    }
  }

  return { ok: true };
}

/**
 * テンプレート準拠チェックに失敗した場合は例外を投げる。
 */
export function assertKintaiCsv(csv: string): void {
  const result = validateKintaiCsv(csv);
  if (result.ok === false) {
    throw new Error(`勤怠CSVのテンプレート検証に失敗しました: ${result.reason}`);
  }
}

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
  const safeName = escapeCsvField(empName);
  const safeId = escapeCsvField(empId);

  const dataLines = rows.flatMap(({ dateStr, start, end }) => [
    `${safeId},${safeName},1,${dateStr}${start}`,
    `${safeId},${safeName},2,${dateStr}${end}`,
  ]);

  // データ行がない月（全休など）でもヘッダーだけ返す
  const csv = dataLines.length === 0 ? HEADER : HEADER + dataLines.join(CRLF) + CRLF;
  const normalized = normalizeKintaiCsv(csv);
  assertKintaiCsv(normalized);
  return normalized;
}
