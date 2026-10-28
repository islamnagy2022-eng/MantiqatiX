export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok';

const allowedHosts: Record<SocialPlatform, ReadonlySet<string>> = {
  facebook: new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com', 'fb.me', 'fb.watch']),
  instagram: new Set(['instagram.com', 'www.instagram.com', 'instagr.am', 'www.instagr.am']),
  tiktok: new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']),
};

export function normalizeSocialUrl(value: unknown, platform: SocialPlatform): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const candidate = /^https?:\/\//i.test(raw) ? raw : \`https://\${raw}\`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !allowedHosts[platform].has(url.hostname.toLowerCase())) return '';
    if (url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function normalizeDialPhone(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const dial = raw.replace(/[^\d+]/g, '');
  const digits = dial.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? dial : '';
}

export function normalizeWhatsAppPhone(value: unknown): string {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '20' + digits.slice(1);
  else if (digits.startsWith('1') && digits.length === 10) digits = '20' + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}
