/// <reference types="@cloudflare/workers-types" />

const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';

export interface PushResult {
  ok: boolean;
  status: number;
  body: string;
}

/** LINE Messaging API の Push Message でグループにテキストを送信する */
export async function pushTextToGroup(
  groupId: string,
  text: string,
  accessToken: string,
): Promise<PushResult> {
  const res = await fetch(LINE_PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text }],
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

/**
 * LINE Webhook の X-Line-Signature を検証する。
 * 署名は HMAC-SHA256(channelSecret, rawBody) を base64 エンコードした値。
 */
export async function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): Promise<boolean> {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = bufferToBase64(sigBytes);
  return timingSafeEqual(expected, signature);
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
