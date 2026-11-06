#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/apps/aistudio-v6"
PARTS="$APP/source-pack-parts"
PACK="$APP/source-r5-preview.tar.xz"
EXPECTED="76e1187918a6a907133399cfe06afec63c41c76d90e60e4ef9bc936f5993eeed"
WORKTREE="$APP/worktree"
cat "$PARTS"/p-*.b64 | base64 --decode > "$PACK"
ACTUAL="$(sha256sum "$PACK" | awk '{print $1}')"
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "V6_SOURCE_PACK_SHA256_MISMATCH" >&2
  exit 1
fi
mkdir -p "$WORKTREE"
tar -xJf "$PACK" -C "$WORKTREE"
for required in package.json bun.lock src/main.tsx src/App.tsx scripts/audit-v6-source-security.mjs scripts/verify-v6-remediation.mjs; do
  test -f "$WORKTREE/$required"
done
node "$WORKTREE/scripts/audit-v6-source-security.mjs" "$WORKTREE"
node "$WORKTREE/scripts/verify-v6-remediation.mjs" "$WORKTREE"
node --test "$WORKTREE/scripts/audit-v6-source-security.test.mjs"
echo "V6_PREVIEW_SOURCE_PREPARE=PASS"
