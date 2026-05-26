#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
artifact_dir="${2:-artifacts}"

bot_token="${SLACK_BOT_TOKEN:-}"
channel_id="${SLACK_CHANNEL_ID:-}"
webhook="${SLACK_WEBHOOK_URL:-}"

if [[ -n "$bot_token" && -n "$channel_id" ]]; then
  auth_mode="api"
elif [[ -n "$webhook" ]]; then
  auth_mode="webhook"
else
  echo "[notify-slack] no Slack credentials, skipping ($*)" >&2
  exit 0
fi

command -v curl >/dev/null 2>&1 || { echo "[notify-slack] curl is required" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "[notify-slack] jq is required" >&2; exit 1; }

repo="${GITHUB_REPOSITORY:-local}"
ref="${GITHUB_REF_NAME:-${GITHUB_REF:-local}}"
sha="${GITHUB_SHA:-local}"
short_sha="${sha:0:7}"
workflow="${GITHUB_WORKFLOW:-init-smoke}"
run_url="${RUN_URL:-https://github.com/${repo}/actions}"
thread_file="$artifact_dir/slack/thread_ts.txt"

status_emoji() {
  case "$1" in
    started|running) echo ":hourglass_flowing_sand:" ;;
    success) echo ":large_green_circle:" ;;
    failed) echo ":red_circle:" ;;
    cancelled|skipped) echo ":large_yellow_circle:" ;;
    *) echo ":red_circle:" ;;
  esac
}

status_label() {
  case "$1" in
    started|running) echo "running" ;;
    success) echo "success" ;;
    failure|failed) echo "FAILED" ;;
    cancelled) echo "cancelled" ;;
    *) echo "$1" ;;
  esac
}

post_webhook() {
  local payload="$1"
  local http_status
  http_status=$(curl -sS -o /tmp/slack-response.txt -w '%{http_code}' \
    -X POST -H 'Content-Type: application/json' \
    --data "$payload" "$webhook")
  if [[ "$http_status" != "200" ]]; then
    echo "[notify-slack] webhook returned HTTP $http_status: $(cat /tmp/slack-response.txt 2>/dev/null)" >&2
    return 1
  fi
}

post_api() {
  local payload="$1"
  local resp ok
  payload=$(printf '%s' "$payload" | jq --arg channel "$channel_id" '. + {channel: $channel}')
  resp=$(curl -sS -X POST \
    -H "Authorization: Bearer $bot_token" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "$payload" \
    https://slack.com/api/chat.postMessage)
  ok=$(printf '%s' "$resp" | jq -r '.ok // false')
  if [[ "$ok" != "true" ]]; then
    echo "[notify-slack] chat.postMessage failed: $(printf '%s' "$resp" | jq -r '.error // "unknown"')" >&2
    return 1
  fi
  printf '%s' "$resp" | jq -r .ts
}

update_api() {
  local ts="$1"
  local payload="$2"
  local resp ok
  payload=$(printf '%s' "$payload" | jq --arg channel "$channel_id" --arg ts "$ts" '. + {channel: $channel, ts: $ts}')
  resp=$(curl -sS -X POST \
    -H "Authorization: Bearer $bot_token" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "$payload" \
    https://slack.com/api/chat.update)
  ok=$(printf '%s' "$resp" | jq -r '.ok // false')
  if [[ "$ok" != "true" ]]; then
    echo "[notify-slack] chat.update failed: $(printf '%s' "$resp" | jq -r '.error // "unknown"')" >&2
    return 1
  fi
}

upload_to_thread() {
  local path="$1"
  local name="$2"
  local ts="$3"
  local title="${4:-$2}"
  local size resp ok upload_url file_id body

  if [[ ! -f "$path" ]]; then
    echo "[notify-slack] no $name to upload at $path" >&2
    return 0
  fi

  size=$(wc -c <"$path" | tr -d '[:space:]')
  if [[ -z "$size" || "$size" -le 0 ]]; then
    echo "[notify-slack] $name is empty, skipping upload" >&2
    return 0
  fi

  resp=$(curl -sS -G \
    -H "Authorization: Bearer $bot_token" \
    --data-urlencode "filename=$name" \
    --data-urlencode "length=$size" \
    https://slack.com/api/files.getUploadURLExternal)
  ok=$(printf '%s' "$resp" | jq -r '.ok // false')
  if [[ "$ok" != "true" ]]; then
    echo "[notify-slack] files.getUploadURLExternal failed for $name: $(printf '%s' "$resp" | jq -r '.error // "unknown"')" >&2
    return 1
  fi
  upload_url=$(printf '%s' "$resp" | jq -r .upload_url)
  file_id=$(printf '%s' "$resp" | jq -r .file_id)

  curl -sS -X POST -F "file=@$path" "$upload_url" >/dev/null

  body=$(jq -nc \
    --arg id "$file_id" \
    --arg title "$title" \
    --arg channel "$channel_id" \
    --arg ts "$ts" \
    '{files: [{id: $id, title: $title}], channel_id: $channel, thread_ts: $ts}')
  resp=$(curl -sS -X POST \
    -H "Authorization: Bearer $bot_token" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "$body" \
    https://slack.com/api/files.completeUploadExternal)
  ok=$(printf '%s' "$resp" | jq -r '.ok // false')
  if [[ "$ok" != "true" ]]; then
    echo "[notify-slack] files.completeUploadExternal failed for $name: $(printf '%s' "$resp" | jq -r '.error // "unknown"')" >&2
    return 1
  fi
  echo "[notify-slack] uploaded $name ($size bytes)" >&2
}

build_blocks() {
  local status="$1"
  local emoji label header
  emoji=$(status_emoji "$status")
  label=$(status_label "$status")
  header="$emoji templates init smoke: $label"

  jq -nc \
    --arg header "$header" \
    --arg status "$label" \
    --arg repo "$repo" \
    --arg ref "$ref" \
    --arg sha "$short_sha" \
    --arg workflow "$workflow" \
    --arg url "$run_url" \
    '[
      {type: "header", text: {type: "plain_text", text: $header, emoji: true}},
      {type: "section", fields: [
        {type: "mrkdwn", text: ("*Status:* " + $status)},
        {type: "mrkdwn", text: ("*Repo:* " + $repo)},
        {type: "mrkdwn", text: ("*Ref:* " + $ref)},
        {type: "mrkdwn", text: ("*Commit:* " + $sha)},
        {type: "mrkdwn", text: ("*Workflow:* " + $workflow)}
      ]},
      {type: "actions", elements: [
        {type: "button", text: {type: "plain_text", text: "Open run"}, url: $url}
      ]}
    ]'
}

wrap_payload() {
  local fallback="$1"
  local blocks="$2"
  jq -nc --arg text "$fallback" --argjson blocks "$blocks" '{text: $text, blocks: $blocks}'
}

send_started() {
  mkdir -p "$artifact_dir/slack"
  local blocks payload ts
  blocks=$(build_blocks started)
  payload=$(wrap_payload "templates init smoke: running" "$blocks")
  if [[ "$auth_mode" == "webhook" ]]; then
    post_webhook "$payload"
    echo "[notify-slack] sent started notification (webhook)" >&2
    return
  fi
  ts=$(post_api "$payload")
  printf '%s' "$ts" >"$thread_file"
  echo "[notify-slack] sent started notification (api, ts=$ts)" >&2
}

send_finished() {
  local status="${1:-unknown}"
  local blocks payload ts reply_blocks reply_payload
  mkdir -p "$artifact_dir/slack"

  blocks=$(build_blocks "$status")
  if [[ "$auth_mode" == "webhook" ]]; then
    blocks=$(printf '%s' "$blocks" | jq \
      --arg text "Artifacts include init-smoke.log plus VHS GIF/MP4 when rendering succeeds. Open the run to download them." \
      '. + [{type: "context", elements: [{type: "mrkdwn", text: $text}]}]')
    payload=$(wrap_payload "templates init smoke: $(status_label "$status")" "$blocks")
    post_webhook "$payload"
    echo "[notify-slack] sent finished notification (webhook)" >&2
    return
  fi

  ts=""
  if [[ -s "$thread_file" ]]; then
    ts=$(tr -d '[:space:]' <"$thread_file")
  fi

  payload=$(wrap_payload "templates init smoke: $(status_label "$status")" "$blocks")
  if [[ -n "$ts" ]]; then
    update_api "$ts" "$payload" || ts=""
  fi
  if [[ -z "$ts" ]]; then
    ts=$(post_api "$payload")
    printf '%s' "$ts" >"$thread_file"
  fi

  reply_blocks=$(jq -nc --arg url "$run_url" \
    '[{type: "section", text: {type: "mrkdwn", text: ("VHS recording and smoke log are attached below when present. Full artifact bundle: <" + $url + "|GitHub Actions run>.")}}]')
  reply_payload=$(wrap_payload "templates init smoke details" "$reply_blocks" | jq --arg ts "$ts" '. + {thread_ts: $ts}')
  post_api "$reply_payload" >/dev/null || true

  upload_to_thread "$artifact_dir/init-smoke.gif" "init-smoke.gif" "$ts" "VHS recording (GIF)" || true
  upload_to_thread "$artifact_dir/init-smoke.mp4" "init-smoke.mp4" "$ts" "VHS recording (MP4)" || true
  upload_to_thread "$artifact_dir/init-smoke.log" "init-smoke.log" "$ts" "Smoke test log" || true
}

case "$mode" in
  started)
    send_started
    ;;
  failed)
    send_finished failed
    ;;
  finished)
    status="${2:-unknown}"
    artifact_dir="${3:-$artifact_dir}"
    thread_file="$artifact_dir/slack/thread_ts.txt"
    send_finished "$status"
    ;;
  *)
    echo "usage: $0 failed [artifact_dir] | started [artifact_dir] | finished <status> [artifact_dir]" >&2
    exit 2
    ;;
esac
