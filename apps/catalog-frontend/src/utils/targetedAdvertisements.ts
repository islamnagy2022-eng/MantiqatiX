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

export const isSafeHttpUrl = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    if (url.username || url.password) return '';
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
};

/**
 * Loads each homepage ad placement independently. A network or RPC failure in
 * one placement must not hide valid ads returned by the other placement.
 */
export async function loadTargetedAdvertisements(
  rpc: TargetedAdvertisementRpc
): Promise<TargetedAdvertisement[]> {
  const placementRows = await Promise.all(AD_SPACES.map(async (space) => {
    try {
      const response = await rpc('get_mnty_targeted_advertisements', {
        p_country_code: 'EG',
        p_governorate_code: null,
        p_center_code: null,
        p_lat: null,
        p_lon: null,
        p_ad_space_id: space,
        p_limit: 4,
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
    const creativeUrl = isSafeHttpUrl(row.creative_url);
    if (!id || !creativeUrl) continue;

    if (!unique.has(id)) {
      unique.set(id, {
        advertisement_id: id,
        title: typeof row.title === 'string' ? row.title : '',
        creative_url: creativeUrl,
        target_url: isSafeHttpUrl(row.target_url) || null,
        ...(typeof row.ad_space_id === 'string' ? { ad_space_id: row.ad_space_id } : {}),
        ...(typeof row.match_level === 'string' ? { match_level: row.match_level } : {}),
      });
    }
  }
  return [...unique.values()];
}
