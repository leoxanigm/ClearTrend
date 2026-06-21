#!/usr/bin/env bash

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-}"
ADMIN_API_KEY="${ADMIN_API_KEY:-$API_KEY}"
TEST_SYMBOL="${TEST_SYMBOL:-NVDA}"
TEST_SYMBOL_2="${TEST_SYMBOL_2:-GOOGL}"
TEST_RANGE="${TEST_RANGE:-1D}"
TEST_HORIZON="${TEST_HORIZON:-1D}"
STRICT_EXTERNAL="${STRICT_EXTERNAL:-0}"
RUN_RATE_LIMIT_TEST="${RUN_RATE_LIMIT_TEST:-0}"

if [ -z "$API_KEY" ]; then
  echo "Missing API_KEY."
  echo "Usage:"
  echo "  API_KEY=ct_xxx ADMIN_API_KEY=ct_admin_xxx $0"
  echo
  echo "Optional env:"
  echo "  BASE_URL=http://localhost:3000"
  echo "  STRICT_EXTERNAL=1       # require external analysis endpoints to return 200"
  echo "  RUN_RATE_LIMIT_TEST=1   # send many requests and expect 429"
  exit 1
fi

if [ -z "$ADMIN_API_KEY" ]; then
  echo "Missing ADMIN_API_KEY."
  echo "Admin endpoints require an API key owned by an ADMIN user."
  exit 1
fi

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

contains_status() {
  local expected="$1"
  local actual="$2"

  for status in $expected; do
    if [ "$status" = "$actual" ]; then
      return 0
    fi
  done

  return 1
}

print_result() {
  local result="$1"
  local name="$2"
  local status="$3"
  local expected="$4"
  local body_file="$5"

  if [ "$result" = "PASS" ]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf "PASS %-58s status=%s\n" "$name" "$status"
    return
  fi

  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf "FAIL %-58s status=%s expected=%s\n" "$name" "$status" "$expected"

  if [ -s "$body_file" ]; then
    echo "---- response body ----"
    sed -n '1,40p' "$body_file"
    echo "-----------------------"
  fi
}

request_raw() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected="$4"
  local key="$5"
  shift 5

  local body_file="$tmp_dir/response-${PASS_COUNT}-${FAIL_COUNT}-${RANDOM}.body"
  local status

  status="$(
    curl -sS \
      -o "$body_file" \
      -w "%{http_code}" \
      -X "$method" \
      -H "Authorization: Bearer $key" \
      "$@" \
      "$BASE_URL$path"
  )"

  if contains_status "$expected" "$status"; then
    print_result "PASS" "$name" "$status" "$expected" "$body_file"
  else
    print_result "FAIL" "$name" "$status" "$expected" "$body_file"
  fi
}

request_json() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected="$4"
  local key="$5"
  local json_body="$6"

  request_raw "$name" "$method" "$path" "$expected" "$key" \
    -H "Content-Type: application/json" \
    -d "$json_body"
}

request_no_body() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected="$4"
  local key="$5"

  request_raw "$name" "$method" "$path" "$expected" "$key"
}

external_expected() {
  if [ "$STRICT_EXTERNAL" = "1" ]; then
    echo "200"
  else
    echo "200 502 503"
  fi
}

echo "Base URL: $BASE_URL"
echo "User API key: ${API_KEY:0:11}..."
echo "Admin API key: ${ADMIN_API_KEY:0:11}..."
echo

echo "== Auth checks =="
request_no_body \
  "missing API key is rejected" \
  "GET" \
  "/api/assets/watchlist" \
  "401" \
  ""

request_no_body \
  "invalid API key is rejected" \
  "GET" \
  "/api/assets/watchlist" \
  "401" \
  "ct_invalid_key"

echo
echo "== Watchlist API =="
request_no_body \
  "GET /api/assets/watchlist" \
  "GET" \
  "/api/assets/watchlist" \
  "200" \
  "$API_KEY"

request_no_body \
  "GET /api/assets/watchlist?symbols=..." \
  "GET" \
  "/api/assets/watchlist?symbols=$TEST_SYMBOL,$TEST_SYMBOL_2" \
  "200" \
  "$API_KEY"

request_json \
  "POST /api/assets/watchlist" \
  "POST" \
  "/api/assets/watchlist" \
  "201" \
  "$API_KEY" \
  "{\"symbol\":\"$TEST_SYMBOL\"}"

request_json \
  "PUT /api/assets/watchlist" \
  "PUT" \
  "/api/assets/watchlist" \
  "200" \
  "$API_KEY" \
  "{\"symbols\":[\"$TEST_SYMBOL\",\"$TEST_SYMBOL_2\"]}"

request_json \
  "PATCH /api/assets/watchlist" \
  "PATCH" \
  "/api/assets/watchlist" \
  "200" \
  "$API_KEY" \
  "{\"symbol\":\"$TEST_SYMBOL\",\"isFavorite\":true}"

request_json \
  "DELETE /api/assets/watchlist one symbol" \
  "DELETE" \
  "/api/assets/watchlist" \
  "200" \
  "$API_KEY" \
  "{\"symbol\":\"$TEST_SYMBOL_2\"}"

request_no_body \
  "DELETE /api/assets/watchlist clear" \
  "DELETE" \
  "/api/assets/watchlist" \
  "200" \
  "$API_KEY"

echo
echo "== Watchlist file API =="
watchlist_file="$tmp_dir/watchlist.json"
printf '{"format":"cleartrend-watchlist","version":1,"symbols":["%s","%s"]}\n' "$TEST_SYMBOL" "$TEST_SYMBOL_2" > "$watchlist_file"

request_no_body \
  "GET /api/assets/watchlist/file" \
  "GET" \
  "/api/assets/watchlist/file" \
  "200" \
  "$API_KEY"

request_raw \
  "POST /api/assets/watchlist/file" \
  "POST" \
  "/api/assets/watchlist/file" \
  "$(external_expected)" \
  "$API_KEY" \
  -F "watchlist=@$watchlist_file;type=application/json"

echo
echo "== Search APIs =="
request_no_body \
  "GET /api/search" \
  "GET" \
  "/api/search?q=$TEST_SYMBOL&type=assets&page=1&limit=10" \
  "200" \
  "$API_KEY"

request_no_body \
  "GET /api/assets/search" \
  "GET" \
  "/api/assets/search?q=$TEST_SYMBOL" \
  "$(external_expected)" \
  "$API_KEY"

echo
echo "== Market/analysis APIs =="
request_no_body \
  "GET /api/assets/candles" \
  "GET" \
  "/api/assets/candles?symbol=$TEST_SYMBOL&range=$TEST_RANGE" \
  "$(external_expected)" \
  "$API_KEY"

request_no_body \
  "GET /api/assets/candles/meta" \
  "GET" \
  "/api/assets/candles/meta?symbol=$TEST_SYMBOL&range=$TEST_RANGE" \
  "$(external_expected)" \
  "$API_KEY"

request_no_body \
  "GET /api/assets/performance" \
  "GET" \
  "/api/assets/performance?symbols=$TEST_SYMBOL,$TEST_SYMBOL_2&range=$TEST_RANGE" \
  "$(external_expected)" \
  "$API_KEY"

request_no_body \
  "GET /api/ml/analyse" \
  "GET" \
  "/api/ml/analyse?symbol=$TEST_SYMBOL&horizon=$TEST_HORIZON" \
  "$(external_expected)" \
  "$API_KEY"

echo
echo "== Admin APIs =="
request_no_body \
  "GET /api/admin/ping" \
  "GET" \
  "/api/admin/ping" \
  "200" \
  "$ADMIN_API_KEY"

request_no_body \
  "GET /api/admin/settings/finance-refresh-rate" \
  "GET" \
  "/api/admin/settings/finance-refresh-rate" \
  "200" \
  "$ADMIN_API_KEY"

request_json \
  "POST /api/admin/settings/finance-refresh-rate" \
  "POST" \
  "/api/admin/settings/finance-refresh-rate" \
  "200" \
  "$ADMIN_API_KEY" \
  '{"refreshRateSeconds":60}'

request_json \
  "PUT /api/admin/settings/finance-refresh-rate" \
  "PUT" \
  "/api/admin/settings/finance-refresh-rate" \
  "200" \
  "$ADMIN_API_KEY" \
  '{"refreshRateSeconds":300}'

request_json \
  "PATCH /api/admin/settings/finance-refresh-rate" \
  "PATCH" \
  "/api/admin/settings/finance-refresh-rate" \
  "200" \
  "$ADMIN_API_KEY" \
  '{"refreshRateSeconds":900}'

request_no_body \
  "DELETE /api/admin/settings/finance-refresh-rate" \
  "DELETE" \
  "/api/admin/settings/finance-refresh-rate" \
  "200" \
  "$ADMIN_API_KEY"

echo
echo "== Validation checks =="
request_json \
  "POST /api/assets/watchlist invalid body" \
  "POST" \
  "/api/assets/watchlist" \
  "400" \
  "$API_KEY" \
  '{"symbol":"not a valid symbol!!!"}'

request_json \
  "PUT /api/admin/settings/finance-refresh-rate invalid value" \
  "PUT" \
  "/api/admin/settings/finance-refresh-rate" \
  "400" \
  "$ADMIN_API_KEY" \
  '{"refreshRateSeconds":123}'

request_no_body \
  "GET /api/ml/analyse invalid horizon" \
  "GET" \
  "/api/ml/analyse?symbol=$TEST_SYMBOL&horizon=10Y" \
  "400 503" \
  "$API_KEY"

if [ "$RUN_RATE_LIMIT_TEST" = "1" ]; then
  echo
  echo "== Rate limit check =="

  rate_limit_seen=0

  for i in $(seq 1 140); do
    body_file="$tmp_dir/rate-limit-$i.body"
    status="$(
      curl -sS \
        -o "$body_file" \
        -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL/api/assets/watchlist"
    )"

    if [ "$status" = "429" ]; then
      rate_limit_seen=1
      break
    fi
  done

  if [ "$rate_limit_seen" = "1" ]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "PASS rate limit returns 429"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "FAIL rate limit did not return 429 after 140 requests"
  fi
else
  SKIP_COUNT=$((SKIP_COUNT + 1))
  echo
  echo "SKIP rate limit check. Set RUN_RATE_LIMIT_TEST=1 to enable it."
fi

echo
echo "Summary:"
echo "  PASS: $PASS_COUNT"
echo "  FAIL: $FAIL_COUNT"
echo "  SKIP: $SKIP_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi

exit 0