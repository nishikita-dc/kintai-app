/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Pages Functions 共通ヘルパー（SSOT）
 *
 * アンダースコア prefix のため Cloudflare がルートとして公開しない。
 */

// ── CORS ─────────────────────────────────────────────────────────────
/**
 * 許可オリジンリストに含まれる場合のみ CORS ヘッダーを付与する。
 * @param methods  許可する HTTP メソッド（デフォルト: GET, POST, OPTIONS）
 */
export function getCorsHeaders(
  request: Request,
  allowedOriginsStr: string,
  methods = 'GET, POST, OPTIONS',
): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = (allowedOriginsStr ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedOrigin = allowed.includes(origin) ? origin : '';

  // 許可リストに含まれないオリジンの場合はヘッダー自体を省略
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    Vary: 'Origin',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  return headers;
}

// ── 認証 ─────────────────────────────────────────────────────────────
/**
 * X-API-Key ヘッダーを検証する。apiKey が空文字の場合は開発用スキップ。
 */
export function authenticate(request: Request, apiKey: string): boolean {
  if (!apiKey) {
    // 本番では API_KEY 必須。未設定時は全リクエストを拒否。
    // 開発時は wrangler.toml の [vars] に API_KEY を設定するか、
    // `wrangler secret put API_KEY` で設定してください。
    console.warn('API_KEY が未設定です。すべてのリクエストが拒否されます。');
    return false;
  }
  return request.headers.get('X-API-Key') === apiKey;
}

// ── empId バリデーション ──────────────────────────────────────────────
const EMP_ID_RE = /^\d{1,6}$/;

/** empId が有効な形式かチェック（数字1〜6桁） */
export function isValidEmpId(empId: string): boolean {
  return EMP_ID_RE.test(empId);
}

// ── JSON レスポンス ───────────────────────────────────────────────────
export function jsonResponse(
  body: unknown,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
