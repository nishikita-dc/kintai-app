export interface AbsentRecord {
  date: string;
  type: '有給' | '欠勤' | '振替休日' | '祝日';
  name?: string;
}

export interface TimeChange {
  date: string;
  inTime: string;
  outTime: string;
}

export interface PreviewRow {
  date: string;
  week: string;
  weekIdx: number;
  type: string;
  in: string;
  out: string;
  isSubstitute: boolean;
}

export interface Summary {
  workDays: number;
  extraDays: number;
  absentTotal: number;
  absentPaid: number;
  absentUnpaid: number;
  absentSub: number;
}

export interface DoctorItem {
  id: string;
  name: string;
}

export interface KvData {
  extraWorkDays: string[];
  absentRecords: AbsentRecord[];
  timeChanges: TimeChange[];
  extraHolidays?: string[];
}

export interface PostBody {
  empId: string;
  year: number;
  month: number;
  data: KvData;
}

export interface ConfirmData {
  empId: string;
  empName: string;
  year: number;
  month: number;
  csv: string;
  confirmedAt: string;
  /** 確定時点の集計サマリー（旧データとの後方互換のため省略可） */
  summary?: Pick<Summary, 'workDays' | 'extraDays' | 'absentPaid' | 'absentUnpaid' | 'absentSub'>;
}

export interface DoctorConfig {
  weekdayHoliday: number;
}

/** 月末メール送信完了の記録 */
export interface SentRecord {
  empId: string;
  year: number;
  month: number;
  sentAt: string;
}
