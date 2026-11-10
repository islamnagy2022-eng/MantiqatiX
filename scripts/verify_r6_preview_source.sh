#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-apps/bizcatalog-manager-6-preview}"
fail() { echo "::error::$*" >&2; exit 1; }
require_file() { [[ -f "$APP_DIR/$1" ]] || fail "Required Preview file missing: $1"; }

for file in package.json bun.lock server.ts Dockerfile index.html PREVIEW_README_AR.md src/App.tsx src/context/AppContext.tsx src/data/seedData.ts src/utils/rules.ts src/utils/aiPixelCommissionEngine.ts; do
  require_file "$file"
done

for forbidden in .data .data-preview .aistudio; do
  [[ ! -e "$APP_DIR/$forbidden" ]] || fail "Forbidden local data directory exists: $forbidden"
done
if find "$APP_DIR" -type f \( -name '.env' -o -name '.env.local' -o -name '.env.production' -o -name '.env.*' \) ! -name '.env.example' -print -quit | grep -q .; then
  fail "A private environment file is present in the Preview application."
fi

grep -Fq "const IS_PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === 'true';" "$APP_DIR/src/context/AppContext.tsx" || fail "Preview mode guard missing from AppContext."
grep -Fq "if (IS_PREVIEW_MODE) return { role: 'guest' };" "$APP_DIR/src/context/AppContext.tsx" || fail "Preview is not forced to guest session."
LOGIN_GUARDS="$(grep -F -c "if (IS_PREVIEW_MODE) return { success: false" "$APP_DIR/src/context/AppContext.tsx" || true)"
[[ "$LOGIN_GUARDS" -ge 3 ]] || fail "Expected all three local password-login handlers to be guarded; found $LOGIN_GUARDS."
grep -Fq "INITIAL_SUBSCRIBERS: Subscriber[] = [];" "$APP_DIR/src/data/seedData.ts" || fail "Initial subscriber fixtures are not empty."
grep -Fq "DEMO_CUSTOMER_ACCOUNTS: DemoCustomerAccount[] = [];" "$APP_DIR/src/utils/rules.ts" || fail "Demo customer accounts remain."
grep -Fq "PREVIEW_ALLOWED_API_PATHS" "$APP_DIR/server.ts" || fail "Server-side Preview API gate is missing."
grep -Fq "MANTIQATIX_PREVIEW_NOTICE" "$APP_DIR/src/App.tsx" || fail "Visible Preview notice is missing."
grep -Fq "FROM oven/bun:1.4.4 AS build" "$APP_DIR/Dockerfile" || fail "Pinned Bun build image missing."
grep -Fq "bun install --frozen-lockfile" "$APP_DIR/Dockerfile" || fail "Docker dependency install is not lockfile-frozen."
grep -Fq "USER bun" "$APP_DIR/Dockerfile" || fail "Preview container must run as non-root."
grep -Fq "MantiqaTix Isolated Preview Backend" "$APP_DIR/server.ts" || fail "Preview health identity is missing."
grep -Fq "isBlockedPreviewAction" "$APP_DIR/src/main.tsx" || fail "Outbound phone/payment safety guard is missing."

if grep -Fq '1482950394857210' "$APP_DIR/index.html" || grep -Fq 'window.fbq' "$APP_DIR/index.html" || grep -Fq "fbq('init'" "$APP_DIR/index.html"; then
  fail "Embedded Meta Pixel bootstrap remains in index.html."
fi
if grep -Fq '1482950394857210' "$APP_DIR/src/utils/aiPixelCommissionEngine.ts" || grep -Fq "TEST_MX_2026" "$APP_DIR/src/utils/aiPixelCommissionEngine.ts"; then
  fail "Default Meta Pixel identity or test event remains."
fi
if grep -Eiq 'preview_customer|preview_provider|preview-only-admin|preview-only' "$APP_DIR/PREVIEW_README_AR.md"; then
  fail "Stale demo-login instructions remain in PREVIEW_README_AR.md."
fi

echo "R6 Preview source integrity checks passed."
