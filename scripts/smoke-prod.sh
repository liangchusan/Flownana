#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://www.flownana.com}"

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
    status="$(curl -s -o /tmp/flownana-smoke-response.txt -w '%{http_code}' \
      -X POST "${BASE_URL}${path}" \
      -H 'Content-Type: application/json' \
      --data "$body")"
  else
    status="$(curl -s -o /tmp/flownana-smoke-response.txt -w '%{http_code}' \
      "${BASE_URL}${path}")"
  fi

  if [[ "$status" != "$expected" ]]; then
    printf 'Expected %s %s to return %s, got %s\n' "$method" "$path" "$expected" "$status" >&2
    printf 'Response:\n' >&2
    sed -n '1,20p' /tmp/flownana-smoke-response.txt >&2
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
  if ! rg -q "$expected" /tmp/flownana-smoke-response.txt; then
    printf 'Expected %s %s response to contain %s\n' "$method" "$path" "$expected" >&2
    printf 'Response:\n' >&2
    sed -n '1,20p' /tmp/flownana-smoke-response.txt >&2
    exit 1
  fi

  pass "$method $path body contains $expected"
}

expect_status GET / 200
expect_status GET /ai-image 200
expect_status GET /ai-video 200
expect_status GET /videos/flownana-home-demo.mp4 200
expect_status GET /api/billing/summary 401
expect_status GET '/api/creations?type=image' 401
expect_status POST /api/generate 401 '{"prompt":"smoke","resolution":"1K","aspectRatio":"1:1"}'
expect_status POST /api/veo/generate 401 '{"prompt":"smoke","modelOptionId":"seedance20fast_480_4","aspectRatio":"16:9"}'
expect_status GET /api/cron/monthly-credits 401
expect_body_contains GET /api/veo/generate '"options"'
