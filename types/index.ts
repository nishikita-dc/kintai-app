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
}
