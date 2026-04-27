#!/usr/bin/env bash
# LINE Bot のシークレットを Cloudflare Workers に登録する補助スクリプト。
# 使い方:
#   bash cron-worker/setup-secrets.sh access   # アクセストークンを再登録
#   bash cron-worker/setup-secrets.sh secret   # チャンネルシークレットを再登録
set -euo pipefail

cd "$(dirname "$0")/.."

mode="${1:-}"
case "$mode" in
  access)
    name="LINE_CHANNEL_ACCESS_TOKEN"
    label="Channel access token (long-lived) を貼り付け Enter:"
    ;;
  secret)
    name="LINE_CHANNEL_SECRET"
    label="Channel secret を貼り付け Enter:"
    ;;
  *)
    echo "使い方: bash cron-worker/setup-secrets.sh [access|secret]" >&2
    exit 1
    ;;
esac

read -s -p "$label " value
echo
len=${#value}
echo "受け取った値の長さ: ${len} 文字"
if [[ -z "$value" ]]; then
  echo "値が空です。中止します。" >&2
  exit 1
fi

# 値を stdin から wrangler に流す（履歴に残らない）
printf "%s" "$value" | npx wrangler secret put "$name" --config cron-worker/wrangler.toml

echo "登録完了: $name (${len} chars)"
