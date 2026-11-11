const baseUrl = String(process.env.SUPABASE_URL || "");
const anonKey = String(process.env.SUPABASE_ANON_KEY || "");
if (new URL(baseUrl).protocol !== "https:" || !anonKey) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required.");
}

const headers = { apikey: anonKey, accept: "application/json" };
const requestJson = async (url) => {
  const response = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${new URL(url).pathname}: ${body.slice(0, 240)}`);
  try { return JSON.parse(body); } catch { throw new Error("Public catalog endpoint returned invalid JSON."); }
};

const directory = await requestJson(`${baseUrl}/functions/v1/public-catalog-directory`);
if (!Array.isArray(directory.businesses) || directory.accessMode !== "PUBLIC_DIRECTORY_READ_ONLY") {
  throw new Error("Public directory contract is invalid.");
}

let directoryItems = 0;
let directoryPrices = 0;
let hiddenItems = 0;
let directCatalogs = 0;
let directItems = 0;
let hiddenServices = 0;

for (const business of directory.businesses) {
  if (!Array.isArray(business.items) || !Array.isArray(business.prices)) {
    throw new Error("Directory business payload is missing item/price arrays.");
  }
  const permissionById = new Map();
  for (const item of business.items) {
    directoryItems++;
    const publicMeta = item?.metadata?.catalog_public ?? {};
    if (publicMeta.is_available !== true) {
      throw new Error("Directory returned an item without explicit public availability.");
    }
    const allowed = publicMeta.show_price === true;
    permissionById.set(String(item.id), allowed);
    if (!allowed) {
      hiddenItems++;
      if (Object.hasOwn(publicMeta, "compare_price")) {
        throw new Error("Directory exposed compare_price without explicit show_price=true.");
      }
    }
  }
  for (const price of business.prices) {
    directoryPrices++;
    if (permissionById.get(String(price.catalog_item_id)) !== true) {
      throw new Error("Directory exposed a price without explicit item consent.");
    }
  }

  if (business.catalogPublished !== true || !business.selectedBranchId || !/^[0-9a-f-]{36}$/i.test(String(business.id))) continue;
  const url = new URL(`${baseUrl}/functions/v1/public-catalog`);
  url.searchParams.set("businessId", String(business.id));
  url.searchParams.set("branchId", String(business.selectedBranchId));
  const catalog = await requestJson(url.toString());
  if (!Array.isArray(catalog.items) || !Array.isArray(catalog.prices) || !Array.isArray(catalog.options)) {
    throw new Error("Direct catalog contract is invalid.");
  }
  directCatalogs++;
  const allowedIds = new Set(
    business.items.filter(item => permissionById.get(String(item.id)) === true).map(item => String(item.id)),
  );
  for (const price of catalog.prices) {
    if (!allowedIds.has(String(price.catalog_item_id))) {
      throw new Error("Direct catalog exposed a price without explicit item consent.");
    }
  }
  for (const option of catalog.options) {
    if (!allowedIds.has(String(option.catalogItemId))) {
      throw new Error("Direct catalog exposed an option price delta without explicit item consent.");
    }
  }
  for (const item of catalog.items) {
    directItems++;
    const allowed = allowedIds.has(String(item.id));
    if (!allowed && item.comparePrice !== null) {
      throw new Error("Direct catalog exposed comparePrice without explicit item consent.");
    }
    if (String(item.type || item.itemType || item.item_type || "").toUpperCase() === "SERVICE") {
      if (!allowed && item.requiresQuote !== true) {
        throw new Error("Unpriced public service was not marked requiresQuote.");
      }
      if (!allowed) hiddenServices++;
    }
  }
}

console.log(
  "PUBLIC_PRICE_DISCLOSURE_SMOKE=PASS"
  + `; businesses=${directory.businesses.length}`
  + `; directory_items=${directoryItems}`
  + `; hidden_items=${hiddenItems}`
  + `; directory_prices=${directoryPrices}`
  + `; direct_catalogs=${directCatalogs}`
  + `; direct_items=${directItems}`
  + `; quote_only_services=${hiddenServices}`,
);
