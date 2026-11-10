#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

request() {
  local method="$1" path="$2" expected="$3" body="${4:-}"
  local status
  if [[ -n "$body" ]]; then
    status="$(curl --silent --show-error --output "$TMP_DIR/response.json" --write-out '%{http_code}' \
      --request "$method" "$BASE_URL$path" \
      --header 'Content-Type: application/json' --data "$body")"
  else
    status="$(curl --silent --show-error --output "$TMP_DIR/response.json" --write-out '%{http_code}' \
      --request "$method" "$BASE_URL$path")"
  fi
  if [[ "$status" != "$expected" ]]; then
    echo "Expected $method $path -> $expected, received $status" >&2
    cat "$TMP_DIR/response.json" >&2 || true
    exit 1
  fi
  cp "$TMP_DIR/response.json" "$TMP_DIR/last-response.json"
}

# Public preview endpoints must be reachable and explicitly non-production.
request GET /api/health 200
jq -e '.status == "ok" and .backend == "MantiqaTix Isolated Preview Backend" and
  .isOfficialProduction == false and .counts.subscribers == 0 and .counts.salesRecords == 0 and
  .counts.adRequests == 0 and .counts.mantygoRequests == 0 and
  .counts.wallets == 0' "$TMP_DIR/last-response.json" >/dev/null

request GET /api/businesses 200
jq -e '.success == true and
  all(.businesses[]; .isVerified == false and .verificationStatus == "unverified" and
    ((.phone // "") == "") and ((.email // "") == "") and
    ((.ownerEmail // "") == "") and ((.ownerWhatsApp // "") == "") and
    ((.ownerSubscriberId // "") == "") and
    (.totalSalesAmount == 0) and (.totalOrdersCount == 0) and (.viewsCount == 0))' \
  "$TMP_DIR/last-response.json" >/dev/null

request GET /api/products 200
jq -e '.success == true and (.products | type == "array")' "$TMP_DIR/last-response.json" >/dev/null

# Every non-public read and every mutation must be denied by the Preview API gate.
request GET /api/production-state 503
jq -e '.previewOnly == true and .readOnly == true' "$TMP_DIR/last-response.json" >/dev/null
request GET /api/subscribers 503
request POST /api/businesses 503 '{}'
jq -e '.previewOnly == true and .readOnly == true' "$TMP_DIR/last-response.json" >/dev/null
request POST /api/production-state 503 '{}'
request POST /api/auth/session-token 503 '{}'
request DELETE /api/businesses/preview-smoke 503

# Basic response hardening must be present on a public API response.
curl --silent --show-error --dump-header "$TMP_DIR/headers.txt" --output /dev/null "$BASE_URL/api/health"
grep -qi '^X-Content-Type-Options: nosniff' "$TMP_DIR/headers.txt"
grep -qi '^Cache-Control: no-store' "$TMP_DIR/headers.txt"
grep -qi '^X-Robots-Tag: noindex, nofollow, noarchive' "$TMP_DIR/headers.txt"

echo "R6 Preview smoke tests passed: public reads work, data is unverified/clean, all writes and private APIs are blocked."
