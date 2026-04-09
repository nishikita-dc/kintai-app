import type { KvData } from '@/types';
import { validateKvData } from './validators';

export { validateKvData };

// ── API キー（環境変数から注入） ──────────────────────
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? '';

/** API 呼び出し用ヘッダーを生成（API キー付き） */
export function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  return h;
}

/** KvData の型ガード。validateKvData の薄いラッパー。 */
export function isValidKvData(data: unknown): data is KvData {
  return validateKvData(data) !== null;
}
