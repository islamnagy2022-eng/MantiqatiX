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

# Correct two stale assertions so the release suite reflects the current safe behavior:
# no fabricated load/telemetry numbers, and sector-specific fallback image assets.
python3 - "$WORKTREE" <<'PY'
from pathlib import Path
import sys
root = Path(sys.argv[1])
p = root / "src/utils/enterprise.test.ts"
s = p.read_text(encoding="utf-8")
old = """test('Simulated Load Test outputs valid capacity results up to 500,000 VUs', () => {
  const res1k = simulateEnterpriseLoadTest(1000);
  assert.equal(res1k.vus, 1000);
  assert.ok(res1k.rps > 1000);
  assert.equal(res1k.degradationLevel, 'none');

  const res500k = simulateEnterpriseLoadTest(500000);
  assert.equal(res500k.vus, 500000);
  assert.ok(res500k.rps > 250000);
  assert.ok(res500k.p95LatencyMs > 0);
  assert.ok(res500k.scalingRecommendation.length > 0);

  const metrics = getLiveTelemetryMetrics(1);
  assert.equal(metrics.dbConnectionPoolMax, 20000);
  assert.ok(metrics.cacheHitRatio > 95);
});"""
new = """test('Load-test placeholder never fabricates capacity or live telemetry measurements', () => {
  const res1k = simulateEnterpriseLoadTest(1000);
  assert.equal(res1k.vus, 1000);
  assert.equal(res1k.rps, 0);
  assert.equal(res1k.requestsPerSecond, 0);
  assert.equal(res1k.degradationLevel, 'heavy');
  assert.equal(res1k.status, 'warning');
  assert.match(res1k.bottleneckReason, /لم يتم تشغيل اختبار حمل فعلي/);

  const res500k = simulateEnterpriseLoadTest(500000);
  assert.equal(res500k.vus, 500000);
  assert.equal(res500k.rps, 0);
  assert.equal(res500k.p95LatencyMs, 0);
  assert.ok(res500k.scalingRecommendation.length > 0);

  const metrics = getLiveTelemetryMetrics(1);
  assert.equal(metrics.dbConnectionPoolMax, 0);
  assert.equal(metrics.cacheHitRatio, 0);
  assert.equal(metrics.globalRPS, 0);
});"""
if old not in s:
    raise SystemExit("stale load-test assertion block not found")
p.write_text(s.replace(old, new), encoding="utf-8")

p = root / "src/utils/rules.test.ts"
s = p.read_text(encoding="utf-8")
if "  getSectorDefaultLogo,\n" not in s:
    s = s.replace("  ensureBusinessStaticImages,\n", "  ensureBusinessStaticImages,\n  getSectorDefaultLogo,\n  getSectorDefaultCover,\n")
s = s.replace(
    "  assert.equal(fixed.logoUrl, DEFAULT_BUSINESS_LOGO_URL);\n  assert.equal(fixed.coverUrl, DEFAULT_BUSINESS_COVER_URL);",
    "  assert.equal(fixed.logoUrl, getSectorDefaultLogo());\n  assert.equal(fixed.coverUrl, getSectorDefaultCover());\n  assert.notEqual(fixed.logoUrl, '');\n  assert.notEqual(fixed.coverUrl, '');"
)
p.write_text(s, encoding="utf-8")
PY

node "$WORKTREE/scripts/audit-v6-source-security.mjs" "$WORKTREE"
node "$WORKTREE/scripts/verify-v6-remediation.mjs" "$WORKTREE"
node --test "$WORKTREE/scripts/audit-v6-source-security.test.mjs"
if find "$WORKTREE" -type f \( -name '.env' -o -name '.env.local' -o -name '*service-role*' -o -name '*production-live-db*' -o -name '*.orig' \) -print -quit | grep -q .; then
  echo "V6_SOURCE_PRIVATE_OR_BACKUP_FILE_FOUND" >&2; exit 1
fi
echo "V6_PREVIEW_SOURCE_PREPARE=PASS"
