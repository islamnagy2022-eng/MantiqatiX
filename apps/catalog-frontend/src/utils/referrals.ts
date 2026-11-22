export const PENDING_REFERRAL_STORAGE_KEY = 'mantiqatix.pending-referral.v1';

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{6,32}$/;

export function normalizeReferralCode(value: unknown): string | null {
  const code = String(value ?? '').trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

export function captureReferralCodeFromSearch(
  search: string,
  storage: Pick<Storage, 'setItem'>,
): string | null {
  const code = normalizeReferralCode(new URLSearchParams(search).get('ref'));
  if (!code) return null;
  storage.setItem(PENDING_REFERRAL_STORAGE_KEY, code);
  return code;
}

export function readPendingReferralCode(storage: Pick<Storage, 'getItem'>): string | null {
  return normalizeReferralCode(storage.getItem(PENDING_REFERRAL_STORAGE_KEY));
}

export function clearPendingReferralCode(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(PENDING_REFERRAL_STORAGE_KEY);
}

export function stripReferralParameter(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('ref');
  const next = params.toString();
  return next ? `?${next}` : '';
}

export function buildReferralInviteUrl(code: unknown, origin: string, basePath: string): string | null {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const canonicalBasePath = (basePath || '/').replace(/\\/legacy\\/?$/, '/');
  const url = new URL(canonicalBasePath, origin);
  url.searchParams.set('ref', normalized);
  return url.toString();
}

export function capturePendingReferralFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const code = captureReferralCodeFromSearch(window.location.search, window.sessionStorage);
    if (code) {
      const nextSearch = stripReferralParameter(window.location.search);
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${nextSearch}${window.location.hash}`);
    }
    return code;
  } catch {
    return null;
  }
}

export function getPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return readPendingReferralCode(window.sessionStorage);
  } catch {
    return null;
  }
}

export function clearPendingReferral(): void {
  if (typeof window === 'undefined') return;
  try {
    clearPendingReferralCode(window.sessionStorage);
  } catch {
    // Storage may be unavailable in strict privacy modes; no auth state depends on it.
  }
}
