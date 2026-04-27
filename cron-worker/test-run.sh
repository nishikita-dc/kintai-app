#!/usr/bin/env bash
# /run エンドポイントを叩いてリマインドを実送信するテストスクリプト。
# 使い方: bash cron-worker/test-run.sh
set -euo pipefail

read -s -p "Channel secret を貼り付けて Enter: " S
echo
echo "受け取った値の長さ: ${#S} 文字"
if [[ "${#S}" -eq 0 ]]; then
  echo "値が空です。中止します。" >&2
  exit 1
fi

echo "→ /run エンドポイントへ送信..."
curl -sS --get --data-urlencode "secret=${S}" \
  "https://kintai-line-reminder.nishikita-dc.workers.dev/run"
echo
unset S
