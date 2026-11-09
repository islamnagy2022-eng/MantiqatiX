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
python3 "$ROOT/scripts/patch-v6-explicit-public-product-flags.py" --self-test
python3 "$ROOT/scripts/patch-v6-explicit-public-product-flags.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-sector-view-markers.py" --self-test
python3 "$ROOT/scripts/patch-v6-sector-view-markers.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-public-governorate-map.py" --self-test
python3 "$ROOT/scripts/patch-v6-public-governorate-map.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-preview-accessibility.py" --self-test
python3 "$ROOT/scripts/patch-v6-preview-accessibility.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-public-context-boundary.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-public-r5-navbar.py" --self-test
python3 "$ROOT/scripts/patch-v6-public-r5-navbar.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-public-sector-grid.py" --self-test
python3 "$ROOT/scripts/patch-v6-public-sector-grid.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-public-sector-grid.py" --tests "$ROOT/scripts/test-v6-public-preview.mjs"
python3 "$ROOT/scripts/patch-v6-public-targeted-ads.py" --self-test
python3 "$ROOT/scripts/patch-v6-public-targeted-ads.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-legacy-qr-compat.py" --self-test
python3 "$ROOT/scripts/patch-v6-legacy-qr-compat.py" "$WORKTREE"
python3 "$ROOT/scripts/disable-v6-medical-directory.py" --self-test
python3 "$ROOT/scripts/disable-v6-medical-directory.py" "$WORKTREE"
python3 "$ROOT/scripts/patch-v6-geo-discovery.py" --self-test
python3 "$ROOT/scripts/patch-v6-geo-discovery.py" "$WORKTREE" "$ROOT/apps/aistudio-v6/geo/egyptGeoDiscovery.ts"
node "$ROOT/scripts/test-v6-geo-discovery-contract.mjs" "$WORKTREE"
node "$ROOT/scripts/test-v6-medical-directory-disabled.mjs" "$WORKTREE"
python3 "$ROOT/scripts/install-v6-public-content-overlay.py" "$WORKTREE"
for required in package.json bun.lock src/main.tsx src/App.tsx src/components/DirectoryView.tsx src/components/common/PublicSectorGrid.tsx src/components/common/PublicTargetedAdsRail.tsx src/services/publicTargetedAds.ts src/services/publicTargetedAds.test.mjs scripts/audit-v6-source-security.mjs scripts/verify-v6-remediation.mjs src/context/PublicAppContext.tsx src/utils/publicContact.ts src/utils/publicCatalog.ts src/components/common/PublicGeoDiscovery.tsx src/data/egyptGeoDiscovery.ts src/services/googleOAuth.ts src/services/publicDirectoryListings.ts src/services/publicDirectoryListings.test.mjs; do
  test -f "$WORKTREE/$required" || { echo "V6_REQUIRED_FILE_MISSING=$required" >&2; exit 1; }
done
node "$ROOT/scripts/test-v6-public-context-boundary.mjs" "$WORKTREE"
node "$WORKTREE/scripts/audit-v6-source-security.mjs" "$WORKTREE"
node "$WORKTREE/scripts/verify-v6-remediation.mjs" "$WORKTREE"
node --test "$WORKTREE/scripts/audit-v6-source-security.test.mjs"
echo "V6_PREVIEW_SOURCE_PREPARE=PASS"
