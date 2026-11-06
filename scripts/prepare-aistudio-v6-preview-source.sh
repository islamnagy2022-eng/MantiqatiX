#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/apps/aistudio-v6"
PACK="$APP/source-r5-preview.tar.xz"
EXPECTED="166db4a0ce4bd52d1e871d44eb8400aa9292b08fb0a2d076b77495284f8497a0"
WORKTREE="$APP/worktree"
ACTUAL="$(sha256sum "$PACK" | awk '{print $1}')"
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "V6_SOURCE_PACK_SHA256_MISMATCH expected=$EXPECTED actual=$ACTUAL" >&2
  exit 1
fi
mkdir -p "$WORKTREE"
tar -xJf "$PACK" -C "$WORKTREE"
for required in package.json bun.lock src/main.tsx src/App.tsx scripts/audit-v6-source-security.mjs scripts/verify-v6-remediation.mjs; do
  test -f "$WORKTREE/$required" || { echo "V6_REQUIRED_FILE_MISSING=$required" >&2; exit 1; }
done
node "$WORKTREE/scripts/audit-v6-source-security.mjs" "$WORKTREE"
node "$WORKTREE/scripts/verify-v6-remediation.mjs" "$WORKTREE"
node --test "$WORKTREE/scripts/audit-v6-source-security.test.mjs"
echo "V6_PREVIEW_SOURCE_PREPARE=PASS"
