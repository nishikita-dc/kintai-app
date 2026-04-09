/**
 * Cloudflare KV キー生成ルール（SSOT）
 *
 * kintai:{empId}:{YYYY-MM}         勤怠例外データ
 * confirmed:{YYYY-MM}:{empId}      確定データ
 * sent:{YYYY-MM}:{empId}           メール送信済み記録
 * config:{empId}                   ドクター個別設定
 */

function pad(month: number | string): string {
  return String(Number(month)).padStart(2, '0');
}

export function kvKintaiKey(empId: string, year: number | string, month: number | string): string {
  return `kintai:${empId}:${year}-${pad(month)}`;
}

export function kvConfirmKey(empId: string, year: number, month: number): string {
  return `confirmed:${year}-${pad(month)}:${empId}`;
}

export function kvConfigKey(empId: string): string {
  return `config:${empId}`;
}

/** KV.list() で月ごとの確定データを列挙するプレフィックス */
export function kvConfirmMonthPrefix(year: number, month: number): string {
  return `confirmed:${year}-${pad(month)}:`;
}

/** メール送信済み記録キー */
export function kvSentKey(empId: string, year: number, month: number): string {
  return `sent:${year}-${pad(month)}:${empId}`;
}

/** KV.list() で月ごとの送信済み記録を列挙するプレフィックス */
export function kvSentMonthPrefix(year: number, month: number): string {
  return `sent:${year}-${pad(month)}:`;
}
