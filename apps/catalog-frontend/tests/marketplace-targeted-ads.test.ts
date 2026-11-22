import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTargetedAdvertisements } from '../src/utils/targetedAdvertisements';

const validAd = (id: string, overrides: Record<string, unknown> = {}) => ({
  advertisement_id: id,
  title: 'إعلان اختبار',
  creative_url: 'https://cdn.example.test/ad.webp',
  target_url: 'https://example.test/offer',
  ...overrides,
});

test('keeps successful placement ads when the other placement rejects', async () => {
  const calls: string[] = [];
  const ads = await loadTargetedAdvertisements(async (_name, args) => {
    calls.push(String(args.p_ad_space_id));
    if (args.p_ad_space_id === 'HOME_HERO') throw new Error('network unavailable');
    return { data: [validAd('sponsored-1')], error: null };
  });

  assert.deepEqual(calls.sort(), ['HOME_HERO', 'HOME_SPONSORED']);
  assert.equal(ads.length, 1);
  assert.equal(ads[0].advertisement_id, 'sponsored-1');
});

test('ignores an RPC error response without discarding another placement', async () => {
  const ads = await loadTargetedAdvertisements(async (_name, args) => (
    args.p_ad_space_id === 'HOME_HERO'
      ? { data: null, error: new Error('permission denied') }
      : { data: [validAd('sponsored-2')], error: null }
  ));

  assert.deepEqual(ads.map((ad) => ad.advertisement_id), ['sponsored-2']);
});

test('rejects unsafe creative URLs and disables unsafe target URLs', async () => {
  const ads = await loadTargetedAdvertisements(async () => ({
    data: [
      validAd('unsafe-creative', { creative_url: 'javascript:alert(1)' }),
      validAd('unsafe-target', { target_url: 'javascript:alert(1)' }),
    ],
    error: null,
  }));

  assert.deepEqual(ads.map((ad) => ad.advertisement_id), ['unsafe-target']);
  assert.equal(ads[0].target_url, null);
});

test('deduplicates ads returned in both placements', async () => {
  const ads = await loadTargetedAdvertisements(async () => ({
    data: [validAd('duplicate')],
    error: null,
  }));

  assert.equal(ads.length, 1);
});

test('fails closed when both placements return invalid payloads', async () => {
  const ads = await loadTargetedAdvertisements(async () => ({
    data: { unexpected: 'object' },
    error: null,
  }));

  assert.deepEqual(ads, []);
});

test('rejects URLs containing embedded credentials', async () => {
  const ads = await loadTargetedAdvertisements(async () => ({
    data: [
      validAd('credential-url', { target_url: 'https://user:secret@example.test/offer' }),
    ],
    error: null,
  }));

  assert.equal(ads.length, 1);
  assert.equal(ads[0].target_url, null);
});
