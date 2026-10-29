import assert from "node:assert/strict";
import fs from "node:fs";

const businessTypes = fs.readFileSync("apps/catalog-frontend/src/types/index.ts", "utf8");
const socialHelper = fs.readFileSync("apps/catalog-frontend/src/utils/socialLinks.ts", "utf8");
const merchant = fs.readFileSync("apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx", "utf8");
const header = fs.readFileSync("apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx", "utf8");
const context = fs.readFileSync("apps/catalog-frontend/src/context/AppContext.tsx", "utf8");
const mapper = fs.readFileSync("apps/catalog-frontend/src/lib/production.ts", "utf8");
const catalogAdmin = fs.readFileSync("supabase/functions/catalog-admin/index.ts", "utf8");
const publicCatalog = fs.readFileSync("supabase/functions/public-catalog/index.ts", "utf8");

for (const property of ["facebookUrl?: string", "instagramUrl?: string", "tiktokUrl?: string"]) {
  assert.ok(businessTypes.includes(property), "Business model must expose social field " + property);
}
for (const platform of ["facebook", "instagram", "tiktok"]) {
  assert.ok(socialHelper.includes(platform + ".com"), "URL allowlist must include " + platform);
}
assert.match(merchant, /setBizFacebookUrl\(currentBusiness\?\.facebookUrl \|\| ''\)/, "Owner social links must hydrate from saved activity data");
assert.match(merchant, /setBizInstagramUrl\(currentBusiness\?\.instagramUrl \|\| ''\)/, "Instagram link must hydrate from production data");
assert.match(merchant, /setBizTikTokUrl\(currentBusiness\?\.tiktokUrl \|\| ''\)/, "TikTok link must hydrate from production data");
assert.match(merchant, /facebookUrl,\s*instagramUrl,\s*tiktokUrl/, "Owner form must persist validated social links together");
assert.match(context, /facebookUrl: updated\.facebookUrl \|\| ''/, "Profile save must transmit Facebook URL");
assert.match(catalogAdmin, /INVALID_SOCIAL_PROFILE_URL/, "Server must reject social URLs outside their platform allowlist");
assert.match(catalogAdmin, /catalog_profile: \{ \.\.\.currentProfile, \.\.\.submittedSocialFields \}/, "Server must persist social links without clobbering other profile fields");
assert.match(publicCatalog, /facebookUrl: String\(profile\.facebook_url \|\| ""\)/, "Public catalog must return saved Facebook URLs");
assert.match(mapper, /instagramUrl: String\(profile\.instagram_url \|\| profile\.instagramUrl/, "Runtime mapper must retain social links");
for (const label of ["اتصال هاتفي", "فيسبوك", "تيك توك", "إنستجرام"]) {
  assert.ok(header.includes(label), "Storefront must render the " + label + " action");
}
const tick = String.fromCharCode(96);
const telHref = "href={" + tick + "tel:$" + "{dialPhone}" + tick + "}";
assert.ok(header.includes(telHref), "Phone action must use the device's dialer");
assert.match(header, /target="_blank" rel="noopener noreferrer"/, "Social links must open safely in a new tab");
assert.match(header, /opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100/, "Activity cover must stay bright by default and darken only on hover or keyboard focus");
const adminDashboard = fs.readFileSync("apps/catalog-frontend/src/components/admin/AdminDashboard.tsx", "utf8");
const linkRules = fs.readFileSync("apps/catalog-frontend/src/utils/rules.ts", "utf8");
const qrModal = fs.readFileSync("apps/catalog-frontend/src/components/common/QRCodeModal.tsx", "utf8");
const merchantDashboard = fs.readFileSync("apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx", "utf8");
const deleteMigration = fs.readFileSync("supabase/migrations/20261028050134_catalog_platform_admin_delete_least_privilege.sql", "utf8");
assert.match(context, /const updateBrowserRoute = \(view: ViewMode/, "View navigation must be synchronized with the URL");
assert.match(context, /window\.history\.pushState/, "Opening app views must create navigable URLs that survive refresh");
assert.match(context, /window\.addEventListener\('popstate', restoreRouteFromLocation\)/, "Browser back/forward must restore the selected app route");
assert.match(context, /requestedView === 'super_admin'/, "Platform-admin route restoration must be explicit");
assert.match(context, /url\.searchParams\.set\('manage', businessId\)/, "Admin-selected business context must survive refresh");
assert.match(adminDashboard, /const readAdminTabFromUrl =/, "Admin tabs must hydrate from the URL");
assert.match(adminDashboard, /url\.searchParams\.set\('tab', tab\)/, "Admin tabs must persist to the URL");
assert.match(deleteMigration, /ALTER FUNCTION public\.mnty_platform_admin_delete_business\(text, uuid, uuid\) SECURITY INVOKER/i, "Business deletion must run as the server caller rather than as the database owner");
assert.match(deleteMigration, /GRANT SELECT ON[\s\S]*public\.orders[\s\S]*TO service_role/i, "Server-only service role must have the minimal select privileges needed for the history guard");
assert.match(deleteMigration, /GRANT SELECT, DELETE ON[\s\S]*public\.catalog_business_settings[\s\S]*TO service_role/i, "Service role must receive only required catalog cleanup privileges");
assert.match(deleteMigration, /REVOKE ALL ON FUNCTION public\.mnty_platform_admin_delete_business\(text, uuid, uuid\) FROM public, anon, authenticated/i, "Deletion RPC must remain unavailable to public client roles");
assert.doesNotMatch(deleteMigration, /SECURITY DEFINER/i, "The deletion repair must not introduce a privileged definer function");
assert.match(deleteMigration, /REVOKE ALL ON FUNCTION public\.mnty_platform_admin_delete_business\(text, uuid, uuid\) FROM public, anon, authenticated/i, "Business deletion RPC must not be callable by public client roles");



assert.ok(linkRules.includes("export function generateStorePublicUrl(origin: string, businessId: string, basePath: string = '/')"), 'Permanent URL builder must accept the deployment base path and stable business ID');
assert.ok(linkRules.includes("new URL(normalizedPath, `${safeOrigin}/`)") , 'Permanent URL builder must join the base path to the site origin safely');
assert.ok(qrModal.includes('generateStorePublicUrl(origin, business.id, getCurrentAppBasePath(window.location.pathname))'), 'QR modal must encode the stable ID under the deployed app path');
assert.ok(merchantDashboard.includes('generateStorePublicUrl(') && merchantDashboard.includes('currentBusiness.id') && merchantDashboard.includes('getCurrentAppBasePath(window.location.pathname)'), 'Merchant QR must reuse the canonical URL builder');
assert.ok(merchantDashboard.includes('src={permanentQrCodeImageUrl}'), 'Merchant QR image must encode the canonical permanent URL');
assert.ok(!merchantDashboard.includes("window.location.origin + '/?store='"), 'Merchant QR must not point at the GitHub Pages account root');
assert.ok(header.includes('getStorePublicLink(currentBusiness)'), 'Share button must copy the canonical permanent link');
assert.ok(adminDashboard.includes('getStorePublicLink(biz)'), 'Platform admin copy action must use the canonical permanent link');

console.log("Business social links, URL routing, and QR contracts passed.");
