#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://www.flownana.com}"
SMOKE_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/flownana-smoke.XXXXXXXX")"
trap 'rm -rf -- "$SMOKE_TEMP_DIR"' EXIT
SMOKE_RESPONSE="$SMOKE_TEMP_DIR/response.txt"

pass() {
  printf 'ok - %s\n' "$1"
}

fail() {
  printf 'not ok - %s\n' "$1" >&2
  exit 1
}

expect_status() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local body="${4:-}"
  local status

  if [[ "$method" == "POST" ]]; then
    status="$(curl -s -o "$SMOKE_RESPONSE" -w '%{http_code}' \
      -X POST "${BASE_URL}${path}" \
      -H 'Content-Type: application/json' \
      --data "$body")"
  else
    status="$(curl -s -o "$SMOKE_RESPONSE" -w '%{http_code}' \
      "${BASE_URL}${path}")"
  fi

  if [[ "$status" != "$expected" ]]; then
    printf 'Expected %s %s to return %s, got %s\n' "$method" "$path" "$expected" "$status" >&2
    printf 'Response:\n' >&2
    sed -n '1,20p' "$SMOKE_RESPONSE" >&2
    exit 1
  fi

  pass "$method $path returns $expected"
}

expect_body_contains() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local body="${4:-}"

  expect_status "$method" "$path" "200" "$body"
  if ! rg -q "$expected" "$SMOKE_RESPONSE"; then
    printf 'Expected %s %s response to contain %s\n' "$method" "$path" "$expected" >&2
    printf 'Response:\n' >&2
    sed -n '1,20p' "$SMOKE_RESPONSE" >&2
    exit 1
  fi

  pass "$method $path body contains $expected"
}

expect_status GET / 200
expect_status GET /home 404
expect_status GET /image 200
expect_status GET /video 200
expect_status GET /assets 200
expect_status GET /ai-image 404
expect_status GET /ai-video 404
expect_status GET /ai-music 404
expect_status GET /brand/flownana-logo.png 200
expect_status GET /brand/login-creative-showcase.png 200
expect_status GET /brand/google-g.png 200
expect_status GET /api/billing/summary 401
expect_status GET '/api/creations?type=image' 401
expect_status POST /api/generate 401 '{"prompt":"smoke","resolution":"1K","aspectRatio":"1:1"}'
expect_status POST /api/veo/generate 401 '{"prompt":"smoke","modelOptionId":"minimaxh3_720_4","aspectRatio":"16:9"}'
expect_status POST /api/suno/generate 410 '{"prompt":"smoke"}'
expect_status GET /api/cron/monthly-credits 401
expect_body_contains GET /api/veo/generate '"options"'
