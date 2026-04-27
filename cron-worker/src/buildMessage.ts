export interface DoctorRef {
  id: string;
  name: string;
}

export type ReminderVariant = 'first' | 'middle' | 'final';

export interface BuildMessageInput {
  year: number;
  month: number;
  /** 今日の日付（JST）。本文の「あと◯日」算出用。 */
  today: number;
  /** 月末最終日（28〜31）。 */
  lastDayOfMonth: number;
  unconfirmed: DoctorRef[];
  appUrl: string;
  /** リマインド種別（25日 / 28日 / 月末最終日）。本文の文言を出し分ける。 */
  variant: ReminderVariant;
}

/**
 * 未確定ドクター一覧から LINE 投稿本文を生成する。
 * unconfirmed.length === 0 のときは null を返す（呼び出し側で送信スキップ）。
 */
export function buildReminderMessage(input: BuildMessageInput): string | null {
  const { year, month, today, lastDayOfMonth, unconfirmed, appUrl, variant } = input;
  if (unconfirmed.length === 0) return null;

  const header = variant === 'final'
    ? '【勤怠データ提出 最終リマインド】'
    : variant === 'middle'
      ? '【勤怠データ提出 リマインド】'
      : '【勤怠データ提出リマインド】';

  const intro = `${year}年${month}月分の勤怠データがまだ未確定の先生:`;
  const list = unconfirmed.map((d) => `・${d.name}先生`).join('\n');

  let deadline: string;
  if (variant === 'final') {
    deadline = `本日(${month}月${lastDayOfMonth}日)が締切です。本日中にご確定をお願いいたします。`;
  } else {
    const remain = Math.max(0, lastDayOfMonth - today);
    deadline = `${month}月${lastDayOfMonth}日が締切です（あと${remain}日）。お早めにご確定をお願いいたします。`;
  }

  const url = `アプリはこちら:\n${appUrl}`;

  return [header, '', intro, '', list, '', deadline, '', url].join('\n');
}
