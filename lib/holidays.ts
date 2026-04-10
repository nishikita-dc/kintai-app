/**
 * 日本の祝日を動的に計算する。
 * 内閣府「国民の祝日に関する法律」に基づく。
 *
 * 対応範囲: 2000年〜2099年（春分・秋分の近似式が有効な範囲）
 */

/** 春分の日を計算（簡易天文計算） */
function vernalEquinox(year: number): number {
  // 2000〜2099年の近似式
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/** 秋分の日を計算 */
function autumnalEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/** 第N月曜日を求める */
function nthMonday(year: number, month: number, n: number): number {
  const first = new Date(year, month - 1, 1).getDay(); // 0=日
  // 最初の月曜日
  const firstMonday = first <= 1 ? 2 - first : 9 - first;
  return firstMonday + (n - 1) * 7;
}

/**
 * 指定年の祝日マップを生成する。
 * 振替休日（祝日が日曜 → 翌月曜）も含む。
 */
export function getHolidaysForYear(year: number): Record<string, string> {
  const holidays: Record<string, string> = {};

  const add = (m: number, d: number, name: string) => {
    const key = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    holidays[key] = name;
  };

  // 固定祝日
  add(1, 1, '元日');
  add(2, 11, '建国記念の日');
  add(2, 23, '天皇誕生日');
  add(4, 29, '昭和の日');
  add(5, 3, '憲法記念日');
  add(5, 4, 'みどりの日');
  add(5, 5, 'こどもの日');
  add(8, 11, '山の日');
  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');

  // 移動祝日（ハッピーマンデー制度）
  add(1, nthMonday(year, 1, 2), '成人の日');        // 1月第2月曜
  add(7, nthMonday(year, 7, 3), '海の日');           // 7月第3月曜
  add(9, nthMonday(year, 9, 3), '敬老の日');         // 9月第3月曜
  add(10, nthMonday(year, 10, 2), 'スポーツの日');   // 10月第2月曜

  // 天文計算による祝日
  add(3, vernalEquinox(year), '春分の日');
  add(9, autumnalEquinox(year), '秋分の日');

  // 振替休日: 祝日が日曜日の場合、その後の最初の平日（非祝日）に振替
  const sorted = Object.keys(holidays).sort();
  for (const dateStr of sorted) {
    const d = new Date(dateStr + 'T00:00:00');
    if (d.getDay() === 0) {
      // 翌日以降で祝日でない日を探す（最大7日間で打ち切り）
      const next = new Date(d);
      for (let guard = 0; guard < 7; guard++) {
        next.setDate(next.getDate() + 1);
        const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
        if (!holidays[nextKey]) {
          holidays[nextKey] = '振替休日';
          break;
        }
      }
    }
  }

  return holidays;
}

/**
 * 指定日付の週（日〜土）に祝日が含まれるか判定する。
 * 月またぎの祝日も正しく検出する。
 */
export function isHolidayWeek(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay();
  const sun = new Date(d);
  sun.setDate(d.getDate() - dayOfWeek);

  const year = d.getFullYear();
  const holidays: Record<string, string> = {
    ...getHolidaysForYear(year - 1),
    ...getHolidaysForYear(year),
    ...getHolidaysForYear(year + 1),
  };

  for (let i = 0; i < 7; i++) {
    const check = new Date(sun);
    check.setDate(sun.getDate() + i);
    const key = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`;
    if (holidays[key]) return true;
  }
  return false;
}

/** 指定年月の祝日マップを取得する */
export function getHolidaysForMonth(year: number, month: number): Record<string, string> {
  const all = getHolidaysForYear(year);
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(prefix)) result[k] = v;
  }
  return result;
}
