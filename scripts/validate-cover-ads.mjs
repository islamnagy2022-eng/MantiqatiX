import assert from "node:assert/strict";
import fs from "node:fs";

const directory = fs.readFileSync("apps/catalog-frontend/src/components/DirectoryView.tsx", "utf8");
const admin = fs.readFileSync("apps/catalog-frontend/src/components/admin/AdminDashboard.tsx", "utf8");
const manager = fs.readFileSync("apps/catalog-frontend/src/components/admin/CoverAdsManager.tsx", "utf8");
const bookingUi = fs.readFileSync("apps/catalog-frontend/src/components/storefront/CoverAdBookingRequest.tsx", "utf8");
const businessHeader = fs.readFileSync("apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx", "utf8");
const adTypes = fs.readFileSync("apps/catalog-frontend/src/types/coverAdvertisements.ts", "utf8");
const adFunction = fs.readFileSync("supabase/functions/catalog-cover-ads/index.ts", "utf8");
const bookingFunction = fs.readFileSync("supabase/functions/cover-ad-booking-request/index.ts", "utf8");
const config = fs.readFileSync("supabase/config.toml", "utf8");

assert.match(directory, /catalog-cover-ads[\s\S]{0,120}PUBLIC_LIST/, "The home directory must load managed public ads");
assert.match(directory, /homeAdsForLocation/, "Home cover ads must use location targeting");
assert.match(directory, /defaultBrandedSlides/, "Official MantiqatiX creatives must remain as fallback");
assert.match(directory, /أعلن معنا هنا/, "The square ad-booking overlay must be visible on the main cover");
assert.match(directory, /w-32 h-32 sm:w-40 sm:h-40/, "The ad CTA must be a small square overlay");
assert.doesNotMatch(directory, /lg:grid-cols-\[minmax\(0,1fr\)_320px\]/, "There must not be a second side ad column");
assert.match(admin, /CoverAdsManager businesses=\{businesses\}/, "The admin must render the dedicated cover ad manager");
assert.match(manager, /COVER_AD_LIMIT_REACHED/, "The admin manager must surface the server-enforced 10-ad limit");
assert.match(manager, /value="MONTHLY"/, "Monthly ad booking must be available");
assert.match(manager, /value="QUARTERLY"/, "Quarterly ad booking must be available");
assert.match(manager, /value="SEMIANNUAL"/, "Semiannual ad booking must be available");
assert.match(manager, /value="ANNUAL"/, "Annual ad booking must be available");
assert.match(manager, /targetBusinessIds/, "The manager must support selecting multiple activity covers");
assert.match(manager, /locationScope/, "The manager must support geographic targeting");
assert.match(adTypes, /'HOME_ONLY' \| 'BUSINESS_COVER' \| 'BOTH'/, "Ad types must distinguish home and activity cover placement");
assert.match(adTypes, /'ALL' \| 'GOVERNORATE' \| 'CITY'/, "Ad types must support all places, governorates, and towns");

assert.match(adFunction, /action === "PUBLIC_LIST"/, "The ads function must provide public reads");
assert.match(adFunction, /requirePlatformAdmin/, "All admin ad mutations must require platform admin authorization");
assert.match(adFunction, /permissions\?\.scope === "PLATFORM"/, "The manager must validate platform scope");
assert.match(adFunction, /existingAds\.length >= 10/, "The server must enforce the 10-ad maximum");
assert.match(adFunction, /calculateEndDate/, "The server must calculate booking end dates");
assert.match(adFunction, /image\/jpeg/, "The server must validate uploaded image MIME types");
assert.match(adFunction, /targetBusinessIds\.length === 0/, "Activity-cover ads must be assigned to at least one activity");
assert.match(bookingUi, /authSession\.role !== "subscriber"/, "Only the signed-in activity owner view may show the booking form");
assert.match(bookingUi, /authSession\.businessId !== currentBusiness\.id/, "The booking form must be scoped to the owner's own activity");
assert.match(bookingUi, /invoke\("cover-ad-booking-request"/, "The booking form must call the protected request endpoint");
assert.match(bookingFunction, /"\OWNER", "BUSINESS_OWNER"/, "The server must enforce business-owner authorization");
assert.match(bookingFunction, /from\("marketing_leads"\)/, "Booking requests must be persisted for administration review");
assert.match(bookingFunction, /targetUrl && \(targetUrl\.length > 1500 \|\| !\/\^https:\\\/\\\//i\.test\(targetUrl\)\)/, "Booking URLs must be validated as HTTPS");
assert.match(businessHeader, /eligibleAds/, "The activity profile cover must display ads targeted to that activity");
assert.match(businessHeader, /<CoverAdBookingRequest \/>/, "The owner-only booking button must appear below the activity cover");
assert.match(config, /\[functions\.catalog-cover-ads\]\s*verify_jwt = false/, "The public ad read endpoint must handle its own action-specific auth");
assert.match(config, /\[functions\.cover-ad-booking-request\]\s*verify_jwt = true/, "The owner request endpoint must require a JWT");

console.log("Cover advertisement manager, targeting, owner request, and security contract passed.");
