export type TargetedAdvertisement = {
  advertisement_id: string;
  title: string;
  creative_url: string;
  target_url?: string | null;
  ad_space_id?: string;
  match_level?: string;
};

type RpcResponse = { data: unknown; error: unknown };
export type TargetedAdvertisementRpc = (
  functionName: string,
  args: Record<string, unknown>
) => PromiseLike<RpcResponse>;

const AD_SPACES = ['HOME_HERO', 'HOME_SPONSORED'] as const;

export type TargetedAdvertisementSpace = (typeof AD_SPACES)[number];

export interface TargetedAdvertisementOptions {
  adSpaces?: readonly TargetedAdvertisementSpace[];
  governorate?: string | null;
  centerCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  limit?: number;
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

const normalizeGovernorateName = (value: unknown): string => String(value || '')
  .toLocaleLowerCase('ar-EG')
  .normalize('NFKC')
  .replace(/[أإآ]/g, 'ا')
  .replace(/[ىي]/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[\\u064B-\\u065F\\u0670]/g, '')
  .replace(/\\s+/g, ' ')
  .trim();

const GOVERNORATE_CODE_BY_NAME = new Map(
  Object.entries(GOVERNORATE_CODES).map(([name, code]) => [normalizeGovernorateName(name), code])
);

export const getPublicGovernorateAdCode = (governorate: string | null | undefined): string | null => {
  const normalized = normalizeGovernorateName(governorate);
  if (!normalized || normalized === 'all' || normalized === normalizeGovernorateName('جميع المحافظات')) return null;
  return GOVERNORATE_CODE_BY_NAME.get(normalized) ?? null;
};

const validEgyptCoordinates = (latitude: unknown, longitude: unknown): { latitude: number; longitude: number } | null => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < 21.5 || latitude > 32.2 || longitude < 24 || longitude > 37.5) return null;
  return { latitude, longitude };
};

export const isSafeHttpsUrl = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const isIpLiteral = hostname.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    if (
      url.protocol !== 'https:' ||
      !hostname ||
      isIpLiteral ||
      url.username ||
      url.password ||
      url.port ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) return '';
    return url.toString();
  } catch {
    return '';
  }
};

/**
 * Loads each homepage ad placement independently. A network or RPC failure in
 * one placement must not hide valid ads returned by the other placement.
 */
export async function loadTargetedAdvertisements(
  rpc: TargetedAdvertisementRpc,
  options: TargetedAdvertisementOptions = {}
): Promise<TargetedAdvertisement[]> {
  const spaces = [...new Set(options.adSpaces ?? AD_SPACES)]
    .filter((space): space is TargetedAdvertisementSpace => AD_SPACES.includes(space));
  const governorateCode = getPublicGovernorateAdCode(options.governorate);
  const coordinates = validEgyptCoordinates(options.latitude, options.longitude);
  const centerCode = typeof options.centerCode === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(options.centerCode)
    ? options.centerCode
    : null;
  const limit = Number.isFinite(options.limit)
    ? Math.min(10, Math.max(1, Math.trunc(options.limit as number)))
    : 4;
  if (spaces.length === 0) return [];

  const placementRows = await Promise.all(spaces.map(async (space) => {
    try {
      const response = await rpc('get_mnty_targeted_advertisements', {
        p_country_code: 'EG',
        p_governorate_code: governorateCode,
        p_center_code: centerCode,
        p_lat: coordinates?.latitude ?? null,
        p_lon: coordinates?.longitude ?? null,
        p_ad_space_id: space,
        p_limit: limit,
      });
      if (response.error || !Array.isArray(response.data)) return [];
      return response.data;
    } catch {
      return [];
    }
  }));

  const unique = new Map<string, TargetedAdvertisement>();
  for (const candidate of placementRows.flat()) {
    if (!candidate || typeof candidate !== 'object') continue;
    const row = candidate as Record<string, unknown>;
    const id = typeof row.advertisement_id === 'string' ? row.advertisement_id.trim() : '';
    const creativeUrl = isSafeHttpsUrl(row.creative_url);
    if (!id || !creativeUrl) continue;

    if (!unique.has(id)) {
      unique.set(id, {
        advertisement_id: id,
        title: typeof row.title === 'string' ? row.title : '',
        creative_url: creativeUrl,
        target_url: isSafeHttpsUrl(row.target_url) || null,
        ...(typeof row.ad_space_id === 'string' ? { ad_space_id: row.ad_space_id } : {}),
        ...(typeof row.match_level === 'string' ? { match_level: row.match_level } : {}),
      });
    }
  }
  return [...unique.values()];
}
