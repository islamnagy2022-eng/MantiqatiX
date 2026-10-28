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
const deleteMigration = fs.readFileSync("supabase/migrations/20261028045414_catalog_platform_admin_delete_security_definer.sql", "utf8");
assert.match(context, /const updateBrowserRoute = \(view: ViewMode/, "View navigation must be synchronized with the URL");
assert.match(context, /window\.history\.pushState/, "Opening app views must create navigable URLs that survive refresh");
assert.match(context, /window\.addEventListener\('popstate', restoreRouteFromLocation\)/, "Browser back/forward must restore the selected app route");
assert.match(context, /requestedView === 'super_admin'/, "Platform-admin route restoration must be explicit");
assert.match(context, /url\.searchParams\.set\('manage', businessId\)/, "Admin-selected business context must survive refresh");
assert.match(adminDashboard, /const readAdminTabFromUrl =/, "Admin tabs must hydrate from the URL");
assert.match(adminDashboard, /url\.searchParams\.set\('tab', tab\)/, "Admin tabs must persist to the URL");
assert.match(deleteMigration, /ALTER FUNCTION public\.mnty_platform_admin_delete_business\(text, uuid, uuid\) SECURITY DEFINER/i, "Business deletion must execute with secure definer rights after edge authorization");
assert.match(deleteMigration, /REVOKE ALL ON FUNCTION public\.mnty_platform_admin_delete_business\(text, uuid, uuid\) FROM public, anon, authenticated/i, "Business deletion RPC must not be callable by public client roles");


console.log("Business social links and click-to-call contract validation passed.");
