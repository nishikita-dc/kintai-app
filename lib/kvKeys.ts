/**
 * Cloudflare KV キー生成ルール（SSOT）
 *
 * doctor_list                      ドクターリスト（管理画面で編集可能）
 * kintai:{empId}:{YYYY-MM}         勤怠例外データ
 * confirmed:{YYYY-MM}:{empId}      確定データ
 * sent:{YYYY-MM}:{empId}           メール送信済み記録
 * config:{empId}                   ドクター個別設定
 * line_group_id                    LINE グループ ID（cron-worker から書込）
 */

/** ドクターリストのKVキー（管理画面から編集可能） */
export const KV_DOCTOR_LIST_KEY = 'doctor_list';

/** LINE グループ ID を保存する KV キー（Bot 招待後の最初の発言で自動保存） */
export const KV_LINE_GROUP_ID_KEY = 'line_group_id';

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
