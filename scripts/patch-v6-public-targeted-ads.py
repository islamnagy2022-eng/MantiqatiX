#!/usr/bin/env python3
"""Add a production-backed, read-only sponsored-ad rail to the isolated V6 Preview."""
from __future__ import annotations
import sys
from pathlib import Path

SERVICE = Path("src/services/publicTargetedAds.ts")
SERVICE_TEST = Path("src/services/publicTargetedAds.test.mjs")
COMPONENT = Path("src/components/common/PublicTargetedAdsRail.tsx")
DIRECTORY = Path("src/components/DirectoryView.tsx")

SERVICE_SOURCE = r'''import { getPublicSupabaseConfig } from './publicSupabaseConfig';

export interface PublicTargetedAd {
  advertisementId: string;
  title: string;
  creativeUrl: string;
  targetUrl: string;
  adSpaceId: 'HOME_SPONSORED';
  matchLevel: 'CENTER' | 'GOVERNORATE' | 'COUNTRY' | 'NEAREST' | 'GLOBAL';
}

interface PublicTargetedAdResponse {
  advertisement_id?: unknown;
  title?: unknown;
  creative_url?: unknown;
  target_url?: unknown;
  ad_space_id?: unknown;
  match_level?: unknown;
}

const GOVERNORATE_CODES: Record<string, string> = {
  'القاهرة': '01', 'الإسكندرية': '02', 'بورسعيد': '03', 'السويس': '04',
  'دمياط': '11', 'الدقهلية': '12', 'الشرقية': '13', 'القليوبية': '14',
  'كفر الشيخ': '15', 'الغربية': '16', 'المنوفية': '17', 'البحيرة': '18',
  'الإسماعيلية': '19', 'الجيزة': '21', 'بني سويف': '22', 'الفيوم': '23',
  'المنيا': '24', 'أسيوط': '25', 'سوهاج': '26', 'قنا': '27', 'أسوان': '28',
  'الأقصر': '29', 'البحر الأحمر': '31', 'الوادي الجديد': '32', 'مطروح': '33',
  'شمال سيناء': '34', 'جنوب سيناء': '35',
};

const cleanText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

function safeHttpsUrl(value: unknown): string {
  const raw = cleanText(value, 1500);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export function mapPublicTargetedAds(value: unknown): PublicTargetedAd[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: PublicTargetedAd[] = [];

  for (const rowValue of value) {
    if (!rowValue || typeof rowValue !== 'object' || Array.isArray(rowValue)) continue;
    const row = rowValue as PublicTargetedAdResponse;
    const advertisementId = cleanText(row.advertisement_id, 120);
    const title = cleanText(row.title, 160);
    const creativeUrl = safeHttpsUrl(row.creative_url);
    const targetUrl = safeHttpsUrl(row.target_url);
    const adSpaceId = cleanText(row.ad_space_id, 60);
    const matchLevel = cleanText(row.match_level, 30);

    // Re-check the public RPC output contract at the browser boundary.
    if (!advertisementId || seen.has(advertisementId) || !title || !creativeUrl || !targetUrl) continue;
    if (adSpaceId !== 'HOME_SPONSORED') continue;
    if (!['CENTER', 'GOVERNORATE', 'COUNTRY', 'NEAREST', 'GLOBAL'].includes(matchLevel)) continue;

    seen.add(advertisementId);
    result.push({
      advertisementId,
      title,
      creativeUrl,
      targetUrl,
      adSpaceId: 'HOME_SPONSORED',
      matchLevel: matchLevel as PublicTargetedAd['matchLevel'],
    });
  }

  return result.slice(0, 8);
}

export async function fetchPublicTargetedAds(
  options: {
    governorate?: string;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    config?: { supabaseUrl: string; publishableKey: string } | null;
  } = {},
): Promise<PublicTargetedAd[]> {
  const config = options.config === undefined ? getPublicSupabaseConfig() : options.config;
  if (!config) return [];

  const base = new URL(config.supabaseUrl);
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co')) {
    throw new Error('PUBLIC_ADS_SUPABASE_URL_INVALID');
  }
  if (!config.publishableKey.trim()) throw new Error('PUBLIC_ADS_PUBLISHABLE_KEY_REQUIRED');

  const governorate = cleanText(options.governorate, 100);
  const governorateCode = governorate && governorate !== 'all'
    ? GOVERNORATE_CODES[governorate] ?? null
    : null;
  const endpoint = base.origin + '/rest/v1/rpc/get_mnty_targeted_advertisements';
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    apikey: config.publishableKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Legacy anon JWTs need Authorization. Opaque sb_publishable keys are identified by apikey.
  if (config.publishableKey.startsWith('eyJ')) {
    headers.Authorization = 'Bearer ' + config.publishableKey;
  }

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_country_code: 'EG',
      p_governorate_code: governorateCode,
      p_center_code: null,
      p_lat: null,
      p_lon: null,
      p_ad_space_id: 'HOME_SPONSORED',
      p_limit: 8,
    }),
    cache: 'no-store',
    signal: options.signal,
  });

  if (!response.ok) throw new Error('PUBLIC_ADS_HTTP_' + response.status);
  return mapPublicTargetedAds(await response.json());
}

export function getPublicGovernorateAdCode(governorate: string): string | null {
  return GOVERNORATE_CODES[governorate] ?? null;
}
'''

COMPONENT_SOURCE = r'''import React, { useEffect, useState } from 'react';
import { fetchPublicTargetedAds, type PublicTargetedAd } from '../../services/publicTargetedAds';

interface PublicTargetedAdsRailProps {
  governorate: string;
}

export const PublicTargetedAdsRail: React.FC<PublicTargetedAdsRailProps> = ({ governorate }) => {
  const [ads, setAds] = useState<PublicTargetedAd[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setAds([]);

    fetchPublicTargetedAds({ governorate, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setAds(result);
      })
      .catch(() => {
        // Advertising is optional: a read/API failure must not block the public directory.
        if (!controller.signal.aborted) setAds([]);
      });

    return () => controller.abort();
  }, [governorate]);

  if (ads.length === 0) return null;

  return (
    <aside
      data-testid="public-targeted-ads-rail"
      aria-label="إعلانات معتمدة"
      dir="rtl"
      className="self-start rounded-3xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-black text-slate-900">إعلانات مميزة</h2>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">مساحات إعلانية معتمدة من المنصة</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500">إعلان</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        {ads.map((ad) => (
          <a
            key={ad.advertisementId}
            data-testid="public-targeted-ad-card"
            href={ad.targetUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            referrerPolicy="no-referrer"
            aria-label={'إعلان: ' + ad.title}
            className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
          >
            <div className="aspect-[5/4] overflow-hidden bg-slate-100">
              <img
                src={ad.creativeUrl}
                alt={ad.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            </div>
            <div className="flex min-h-16 items-start gap-2 p-3">
              <span aria-hidden="true" className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">إعلان</span>
              <span className="min-w-0 text-xs font-black leading-5 text-slate-800">{ad.title}</span>
            </div>
          </a>
        ))}
      </div>
    </aside>
  );
};
'''

TEST_SOURCE = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicTargetedAds, mapPublicTargetedAds, getPublicGovernorateAdCode } from './publicTargetedAds.ts';

function makeResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ads = [
  {
    advertisement_id: 'GLOBAL-1',
    title: 'مساحة إعلانية معتمدة',
    creative_url: 'https://cdn.example.test/ad.svg',
    target_url: 'https://example.test/advertise',
    ad_space_id: 'HOME_SPONSORED',
    match_level: 'GLOBAL',
  },
  {
    advertisement_id: 'wrong-space',
    title: 'ليس موضعاً جانبياً',
    creative_url: 'https://cdn.example.test/other.svg',
    target_url: 'https://example.test/',
    ad_space_id: 'HOME_HERO',
    match_level: 'GLOBAL',
  },
  {
    advertisement_id: 'unsafe-target',
    title: 'رابط غير آمن',
    creative_url: 'https://cdn.example.test/unsafe.svg',
    target_url: 'javascript:alert(1)',
    ad_space_id: 'HOME_SPONSORED',
    match_level: 'GLOBAL',
  },
];

test('maps only unique, HTTPS, HOME_SPONSORED ad results', () => {
  const result = mapPublicTargetedAds([...ads, ads[0]]);
  assert.equal(result.length, 1);
  assert.equal(result[0].advertisementId, 'GLOBAL-1');
  assert.equal(result[0].adSpaceId, 'HOME_SPONSORED');
});

test('calls the read-only public RPC with correct Egypt and placement scope', async () => {
  let requestUrl = '';
  let requestInit;
  const result = await fetchPublicTargetedAds({
    governorate: 'المنوفية',
    config: { supabaseUrl: 'https://project.example.supabase.co', publishableKey: 'sb_publishable_test' },
    fetchImpl: async (url, init) => {
      requestUrl = String(url);
      requestInit = init;
      return makeResponse([ads[0]]);
    },
  });

  assert.equal(requestUrl, 'https://project.example.supabase.co/rest/v1/rpc/get_mnty_targeted_advertisements');
  assert.equal(requestInit.method, 'POST');
  assert.equal(requestInit.headers.apikey, 'sb_publishable_test');
  assert.equal(requestInit.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(requestInit.body), {
    p_country_code: 'EG',
    p_governorate_code: '17',
    p_center_code: null,
    p_lat: null,
    p_lon: null,
    p_ad_space_id: 'HOME_SPONSORED',
    p_limit: 8,
  });
  assert.equal(result.length, 1);
});

test('adds Authorization only when a legacy anon JWT is used', async () => {
  const key = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') + '.signature';
  let requestHeaders;
  await fetchPublicTargetedAds({
    config: { supabaseUrl: 'https://project.example.supabase.co', publishableKey: key },
    fetchImpl: async (_url, init) => {
      requestHeaders = init.headers;
      return makeResponse([]);
    },
  });
  assert.equal(requestHeaders.Authorization, 'Bearer ' + key);
});

test('uses global targeting for all governorates and returns no ads for empty responses', async () => {
  assert.equal(getPublicGovernorateAdCode('all'), null);
  assert.equal(getPublicGovernorateAdCode('اسم غير معروف'), null);
  const result = await fetchPublicTargetedAds({
    governorate: 'all',
    config: { supabaseUrl: 'https://project.example.supabase.co', publishableKey: 'sb_publishable_test' },
    fetchImpl: async (_url, init) => {
      assert.equal(JSON.parse(init.body).p_governorate_code, null);
      return makeResponse([]);
    },
  });
  assert.deepEqual(result, []);
});

test('does not issue a request when no public Supabase config is available', async () => {
  const result = await fetchPublicTargetedAds({ config: null, fetchImpl: async () => { throw new Error('must not fetch'); } });
  assert.deepEqual(result, []);
});

test('rejects non-HTTPS Supabase URLs and surfaces HTTP failures', async () => {
  await assert.rejects(() => fetchPublicTargetedAds({
    config: { supabaseUrl: 'http://project.supabase.co', publishableKey: 'sb_publishable_test' },
  }), /URL_INVALID/);

  await assert.rejects(() => fetchPublicTargetedAds({
    config: { supabaseUrl: 'https://project.example.supabase.co', publishableKey: 'sb_publishable_test' },
    fetchImpl: async () => makeResponse({ message: 'denied' }, 403),
  }), /HTTP_403/);
});
'''

IMPORT_ANCHOR = "import { PublicSectorGrid } from './common/PublicSectorGrid';"
GRID_MOUNT = "        <PublicSectorGrid businesses={businesses} selectedSectorId={selectedSectorId} onSelectSector={(sectorId) => { setSelectedSectorId(sectorId); setSelectedActivityId('all'); setSelectedSpecialtyId('all'); }} />"
E2E_ANCHOR = "  const previewUrl = 'http://127.0.0.1:4173/MantiqaTix/v6-preview/';"
E2E_ASSERT_ANCHOR = "  const liveCatalogStrip = page.getByTestId('live-published-catalog-strip');"

E2E_ROUTE = r'''  const requestedSponsoredAdScopes = [];
  await page.route('**/rest/v1/rpc/get_mnty_targeted_advertisements', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
      } });
      return;
    }
    const body = route.request().postDataJSON();
    requestedSponsoredAdScopes.push(body);
    assert.equal(body.p_country_code, 'EG');
    assert.equal(body.p_ad_space_id, 'HOME_SPONSORED');
    assert.equal(body.p_limit, 8);
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify([
      { advertisement_id: 'GLOBAL-fixture-1', title: 'إعلان اختبار 1', creative_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/assets/mnty-cover-ad-1.svg', target_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/', ad_space_id: 'HOME_SPONSORED', match_level: 'GLOBAL' },
      { advertisement_id: 'GLOBAL-fixture-2', title: 'إعلان اختبار 2', creative_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/assets/mnty-cover-ad-2.svg', target_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/', ad_space_id: 'HOME_SPONSORED', match_level: 'GLOBAL' },
      { advertisement_id: 'GLOBAL-fixture-3', title: 'إعلان اختبار 3', creative_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/assets/mnty-cover-ad-3.svg', target_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/', ad_space_id: 'HOME_SPONSORED', match_level: 'GLOBAL' },
      { advertisement_id: 'GLOBAL-fixture-4', title: 'إعلان اختبار 4', creative_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/assets/mnty-ad-space-booking-banner.svg', target_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/', ad_space_id: 'HOME_SPONSORED', match_level: 'GLOBAL' },
      { advertisement_id: 'NOT-SPONSORED', title: 'مساحة مختلفة', creative_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/assets/mnty-cover-ad-1.svg', target_url: 'https://islamnagy2022-eng.github.io/MantiqaTix/', ad_space_id: 'HOME_HERO', match_level: 'GLOBAL' },
    ]) });
  });

'''

E2E_ASSERT = r'''  const sponsoredAdsRail = page.getByTestId('public-targeted-ads-rail');
  await sponsoredAdsRail.waitFor({ timeout: 15000 });
  assert.equal(await sponsoredAdsRail.getByTestId('public-targeted-ad-card').count(), 4, 'Only HOME_SPONSORED records should appear');
  assert.match(await sponsoredAdsRail.innerText(), /إعلان اختبار 1/);
  const firstSponsoredAd = sponsoredAdsRail.getByRole('link', { name: 'إعلان: إعلان اختبار 1' });
  assert.equal(await firstSponsoredAd.getAttribute('rel'), 'sponsored noopener noreferrer');
  assert.equal(await firstSponsoredAd.getAttribute('target'), '_blank');
  assert.ok(requestedSponsoredAdScopes.length >= 1, 'The public targeted-ad RPC must be called');
  console.log('V6_PUBLIC_TARGETED_ADS=PASS placement=HOME_SPONSORED items=4 safe_links=true');

'''

E2E_REGION_ASSERT = r'''  await governorateExplorer.getByTestId('public-governorate-option').filter({ hasText: 'المنوفية' }).click();
  for (let attempt = 0; attempt < 40 && !requestedSponsoredAdScopes.some((scope) => scope.p_governorate_code === '17'); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(requestedSponsoredAdScopes.some((scope) => scope.p_governorate_code === '17'), 'Monufia must use the authoritative governorate code in the ad lookup');
'''

def replace_once(source: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in source:
        return source, False
    count = source.count(old)
    if count != 1:
        raise ValueError(f"{label}: expected one anchor; found {count}")
    return source.replace(old, new, 1), True

def write_exact(path: Path, content: str) -> bool:
    if path.exists():
        existing = path.read_text(encoding="utf-8")
        if existing == content:
            return False
        if existing.strip():
            raise ValueError(f"Refusing to overwrite non-matching file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True

def patch_directory(source: str) -> tuple[str, bool]:
    original = source
    source, _ = replace_once(source, IMPORT_ANCHOR,
        IMPORT_ANCHOR + "\nimport { PublicTargetedAdsRail } from './common/PublicTargetedAdsRail';",
        "targeted ads import")
    new_grid = "        <div dir=\"rtl\" className=\"grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_270px]\">\n" + GRID_MOUNT + "\n          <PublicTargetedAdsRail governorate={governorate} />\n        </div>"
    source, _ = replace_once(source, GRID_MOUNT, new_grid, "sector grid/ads rail layout")
    if source.count("import { PublicTargetedAdsRail }") != 1 or source.count("<PublicTargetedAdsRail governorate={governorate} />") != 1:
        raise ValueError("targeted ads rail must be imported and mounted exactly once")
    return source, source != original

def patch_e2e(source: str) -> tuple[str, bool]:
    original = source
    source, _ = replace_once(source, E2E_ANCHOR, E2E_ROUTE + E2E_ANCHOR, "targeted ads API fixture route")
    source, _ = replace_once(source, E2E_ASSERT_ANCHOR, E2E_ASSERT + E2E_ASSERT_ANCHOR, "targeted ads browser assertions")
    marker = "  assert.equal(await page.getByLabel('تصفية الأنشطة حسب المحافظة').inputValue(), 'المنوفية', 'Selecting a governorate must update the directory filter');"
    source, _ = replace_once(source, marker, E2E_REGION_ASSERT + marker, "targeted ads governorate scope assertion")
    return source, source != original

def self_test() -> None:
    fixture = IMPORT_ANCHOR + "\n" + GRID_MOUNT + "\n"
    updated, changed = patch_directory(fixture)
    again, changed_again = patch_directory(updated)
    assert changed and not changed_again and updated == again
    e2e_fixture = E2E_ANCHOR + "\n" + E2E_ASSERT_ANCHOR + "\n"
    e2e_fixture += "  assert.equal(await page.getByLabel('تصفية الأنشطة حسب المحافظة').inputValue(), 'المنوفية', 'Selecting a governorate must update the directory filter');"
    e2e, e2e_changed = patch_e2e(e2e_fixture)
    e2e_again, e2e_changed_again = patch_e2e(e2e)
    assert e2e_changed and not e2e_changed_again and e2e == e2e_again
    assert SERVICE_SOURCE.count("'HOME_SPONSORED'") >= 2
    assert "service_role" not in SERVICE_SOURCE
    assert 'rel="sponsored noopener noreferrer"' in COMPONENT_SOURCE

def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_PUBLIC_TARGETED_ADS_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-public-targeted-ads.py <extracted-v6-root>")
    root = Path(sys.argv[1]).resolve()
    changed = []
    for relative, content in [(SERVICE, SERVICE_SOURCE), (SERVICE_TEST, TEST_SOURCE), (COMPONENT, COMPONENT_SOURCE)]:
        if write_exact(root / relative, content):
            changed.append(str(relative))
    directory_path = root / DIRECTORY
    e2e_path = Path(__file__).resolve().parent / "test-v6-public-preview.mjs"
    if not directory_path.is_file() or not e2e_path.is_file():
        raise SystemExit("V6_PUBLIC_TARGETED_ADS_REQUIRED_TARGET_MISSING")
    directory, directory_changed = patch_directory(directory_path.read_text(encoding="utf-8"))
    e2e, e2e_changed = patch_e2e(e2e_path.read_text(encoding="utf-8"))
    if directory_changed:
        directory_path.write_text(directory, encoding="utf-8")
        changed.append(str(DIRECTORY))
    if e2e_changed:
        e2e_path.write_text(e2e, encoding="utf-8")
        changed.append("scripts/test-v6-public-preview.mjs")
    print("V6_PUBLIC_TARGETED_ADS_OVERLAY=PASS changed=" + ",".join(changed))

if __name__ == "__main__":
    main()
