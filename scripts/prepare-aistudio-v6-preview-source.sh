#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/apps/aistudio-v6"
PARTS="$APP/source-pack-parts"
PACK="$APP/source-r5-preview.tar.xz"
EXPECTED="34a7665f313c9488f1959c72a2ef13ef594a54ce228e26061095c96f9bb7bd77"
WORKTREE="$APP/worktree"
cat "$PARTS"/p-*.b64 | base64 --decode > "$PACK"
ACTUAL="$(sha256sum "$PACK" | awk '{print $1}')"
test "$ACTUAL" = "$EXPECTED" || { echo "V6_SOURCE_PACK_SHA256_MISMATCH expected=$EXPECTED actual=$ACTUAL" >&2; exit 1; }
rm -rf "$WORKTREE"
mkdir -p "$WORKTREE"
tar -xJf "$PACK" -C "$WORKTREE"
for required in package.json bun.lock src/main.tsx src/App.tsx scripts/audit-v6-source-security.mjs scripts/verify-v6-remediation.mjs; do
  test -f "$WORKTREE/$required" || { echo "V6_REQUIRED_FILE_MISSING=$required" >&2; exit 1; }
done
node "$WORKTREE/scripts/audit-v6-source-security.mjs" "$WORKTREE"
node "$WORKTREE/scripts/verify-v6-remediation.mjs" "$WORKTREE"
node --test "$WORKTREE/scripts/audit-v6-source-security.test.mjs"
if find "$WORKTREE" -type f \( -name '.env' -o -name '.env.local' -o -name '*service-role*' -o -name '*production-live-db*' -o -name '*.orig' \) -print -quit | grep -q .; then
  echo "V6_SOURCE_PRIVATE_OR_BACKUP_FILE_FOUND" >&2; exit 1
fi
echo "V6_PREVIEW_SOURCE_PREPARE=PASS"
