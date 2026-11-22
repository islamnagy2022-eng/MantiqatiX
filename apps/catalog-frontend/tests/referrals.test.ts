import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PENDING_REFERRAL_STORAGE_KEY,
  buildReferralInviteUrl,
  captureReferralCodeFromSearch,
  clearPendingReferralCode,
  normalizeReferralCode,
  readPendingReferralCode,
  stripReferralParameter,
} from '../src/utils/referrals';

class MemoryStorage {
  private values = new Map<string, string>();
  setItem(key: string, value: string): void { this.values.set(key, value); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
}

test('normalizes referral codes and rejects malformed values', () => {
  assert.equal(normalizeReferralCode(' ab12cd34 '), 'AB12CD34');
  assert.equal(normalizeReferralCode('ABC-1234'), null);
  assert.equal(normalizeReferralCode('ABC'), null);
  assert.equal(normalizeReferralCode('A'.repeat(33)), null);
});

test('captures a referral query parameter in session-scoped storage', () => {
  const storage = new MemoryStorage();
  assert.equal(captureReferralCodeFromSearch('?ref=ab12cd34&view=directory', storage), 'AB12CD34');
  assert.equal(readPendingReferralCode(storage), 'AB12CD34');
  assert.equal(storage.getItem(PENDING_REFERRAL_STORAGE_KEY), 'AB12CD34');
});

test('does not overwrite a pending referral with an invalid query parameter', () => {
  const storage = new MemoryStorage();
  storage.setItem(PENDING_REFERRAL_STORAGE_KEY, 'ZXCV1234');
  assert.equal(captureReferralCodeFromSearch('?ref=bad-code', storage), null);
  assert.equal(readPendingReferralCode(storage), 'ZXCV1234');
});

test('builds a stable invite URL at the configured public application base', () => {
  assert.equal(
    buildReferralInviteUrl('ab12cd34', 'https://example.test', '/MantiqatiX/'),
    'https://example.test/MantiqatiX/?ref=AB12CD34',
  );
  assert.equal(
    buildReferralInviteUrl('ab12cd34', 'https://example.test', '/MantiqatiX/legacy/'),
    'https://example.test/MantiqatiX/?ref=AB12CD34',
  );
  assert.equal(buildReferralInviteUrl('BAD-CODE', 'https://example.test', '/'), null);
});

test('clears a referral only after a terminal claim result', () => {
  const storage = new MemoryStorage();
  storage.setItem(PENDING_REFERRAL_STORAGE_KEY, 'AB12CD34');
  clearPendingReferralCode(storage);
  assert.equal(readPendingReferralCode(storage), null);
});

test('strips referral attribution from the address bar while preserving other route state', () => {
  assert.equal(stripReferralParameter('?ref=AB12CD34&view=account_portal&tab=overview'), '?view=account_portal&tab=overview');
  assert.equal(stripReferralParameter('?ref=AB12CD34'), '');
});
