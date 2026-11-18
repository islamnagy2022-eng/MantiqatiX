// Collect all active ADDRESS consent listing IDs without assuming the API returns
// the full requested range. Supabase/PostgREST may enforce a lower max_rows cap.
export async function collectActiveAddressConsentIds(fetchPage, pageSize = 1000) {
  const ids = new Set();
  let offset = 0;

  while (true) {
    const { data, error } = await fetchPage(offset, pageSize);
    if (error || !Array.isArray(data)) return { ids: [], ready: false };

    const rows = data;
    if (rows.length === 0) break;

    for (const row of rows) {
      const id = String(row?.listing_id || "");
      if (id) ids.add(id);
    }

    // Advance by the actual number returned, not the requested range size.
    // This remains complete even if the API caps responses below pageSize.
    offset += rows.length;
  }

  return { ids: [...ids], ready: true };
}
