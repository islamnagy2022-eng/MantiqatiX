#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/apps/aistudio-v6"
PACK="$APP/source-r5-preview.tar.xz"
EXPECTED="afab4504ba86960f7ac2a64e6ad969d901be80f6022f3393e14cf3ecc81f453f"
WORKTREE="$APP/worktree"
ACTUAL="$(sha256sum "$PACK" | awk '{print $1}')"
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "V6_SOURCE_PACK_SHA256_MISMATCH expected=$EXPECTED actual=$ACTUAL" >&2
  exit 1
fi
rm -rf "$WORKTREE"
mkdir -p "$WORKTREE"
tar -xJf "$PACK" -C "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-release-test-contract.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-public-taxonomy.py" --self-test
python3 "$ROOT/scripts/patch-v6-public-taxonomy.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-verification-indicator.py" --self-test
python3 "$ROOT/scripts/patch-v6-verification-indicator.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-verified-first.py" --self-test
python3 "$ROOT/scripts/patch-v6-verified-first.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-public-home-cover.py" --self-test
python3 "$ROOT/scripts/patch-v6-public-home-cover.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-live-published-catalog.py" --self-test
python3 "$ROOT/scripts/patch-v6-live-published-catalog.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-sector-view-markers.py" --self-test
python3 "$ROOT/scripts/patch-v6-sector-view-markers.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-public-governorate-map.py" --self-test
python3 "$ROOT/scripts/patch-v6-public-governorate-map.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-preview-accessibility.py" --self-test
python3 "$ROOT/scripts/patch-v6-preview-accessibility.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-public-context-boundary.py" "$WORKTREE"
for required in package.json bun.lock src/main.tsx src/App.tsx src/components/DirectoryView.tsx scripts/audit-v6-source-security.mjs scripts/verify-v6-remediation.mjs src/context/PublicAppContext.tsx src/utils/publicContact.ts src/utils/publicCatalog.ts src/data/medicalSpecialties.ts; do
  test -f "$WORKTREE/$required" || { echo "V6_REQUIRED_FILE_MISSING=$required" >&2; exit 1; }
done
node "$ROOT/scripts/test-v6-public-context-boundary.mjs" "$WORKTREE"
node "$WORKTREE/scripts/audit-v6-source-security.mjs" "$WORKTREE"
node "$WORKTREE/scripts/verify-v6-remediation.mjs" "$WORKTREE"
node --test "$WORKTREE/scripts/audit-v6-source-security.test.mjs"
echo "V6_PREVIEW_SOURCE_PREPARE=PASS"
