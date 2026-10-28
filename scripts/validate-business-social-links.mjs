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

console.log("Business social links and click-to-call contract validation passed.");
