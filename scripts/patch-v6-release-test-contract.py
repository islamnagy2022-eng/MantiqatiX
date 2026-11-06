#!/usr/bin/env python3
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
enterprise = root / "src/utils/enterprise.test.ts"
rules = root / "src/utils/rules.test.ts"

def replace_test(path: Path, pattern: str, replacement: str, marker: str) -> None:
    source = path.read_text(encoding="utf-8")
    if marker in source:
        return
    match = re.search(pattern, source, flags=re.DOTALL)
    if not match:
        raise SystemExit(f"V6_TEST_CONTRACT_ANCHOR_NOT_FOUND: {path.name}")
    end = source.find("\n});", match.start())
    if end < 0:
        raise SystemExit(f"V6_TEST_CONTRACT_END_NOT_FOUND: {path.name}")
    end += len("\n});")
    path.write_text(source[:match.start()] + replacement + source[end:], encoding="utf-8")

enterprise_replacement = """test('Load-test placeholder never fabricates capacity or live telemetry measurements', () => {
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
  assert.equal(metrics.reqPerSec, 0);
});"""
replace_test(
    enterprise,
    r"test\('Simulated Load Test outputs valid capacity results up to 500,000 VUs',\s*\(\)\s*=>\s*\{",
    enterprise_replacement,
    "Load-test placeholder never fabricates capacity",
)

rules_source = rules.read_text(encoding="utf-8")
if "getSectorDefaultLogo," not in rules_source:
    anchor = "  DEFAULT_BUSINESS_COVER_URL,"
    if anchor not in rules_source:
        raise SystemExit("V6_RULES_IMPORT_ANCHOR_NOT_FOUND")
    rules_source = rules_source.replace(anchor, anchor + "\n  getSectorDefaultLogo,\n  getSectorDefaultCover,", 1)
    rules.write_text(rules_source, encoding="utf-8")

rules_replacement = """test('ensureBusinessStaticImages assigns sector-specific default logo and cover when empty', () => {
  const fixed = ensureBusinessStaticImages('', '   ');
  assert.equal(fixed.logoUrl, getSectorDefaultLogo('services'));
  assert.equal(fixed.coverUrl, getSectorDefaultCover('services'));
  assert.notEqual(fixed.logoUrl, DEFAULT_BUSINESS_LOGO_URL);
  assert.notEqual(fixed.coverUrl, DEFAULT_BUSINESS_COVER_URL);
});"""
replace_test(
    rules,
    r"test\('ensureBusinessStaticImages assigns default static logo and cover when empty',\s*\(\)\s*=>\s*\{",
    rules_replacement,
    "ensureBusinessStaticImages assigns sector-specific default logo",
)

directory_view = root / "src/components/DirectoryView.tsx"
directory_source = directory_view.read_text(encoding="utf-8")
select_anchor = "<select\\n              value={selectedGovFilter}"
select_replacement = '<select\\n              aria-label="تصفية الأنشطة حسب المحافظة"\\n              value={selectedGovFilter}'
if 'aria-label="تصفية الأنشطة حسب المحافظة"' not in directory_source:
    if select_anchor not in directory_source:
        raise SystemExit("V6_DIRECTORY_GOVERNORATE_SELECT_ANCHOR_NOT_FOUND")
    directory_view.write_text(directory_source.replace(select_anchor, select_replacement, 1), encoding="utf-8")

print("V6_RELEASE_PREVIEW_CONTRACT_PATCH=PASS")
