import fs from "node:fs";
import assert from "node:assert/strict";

const helper = fs.readFileSync("supabase/functions/_shared/public-contact-visibility.mjs", "utf8");
const storefront = fs.readFileSync("supabase/functions/public-catalog/index.ts", "utf8");
const directory = fs.readFileSync("supabase/functions/public-catalog-directory/index.ts", "utf8");
const mapper = fs.readFileSync("apps/catalog-frontend/src/lib/production.ts", "utf8");

assert.match(storefront, /getExplicitPublicContact/);
assert.match(directory, /getExplicitPublicContact/);
assert.match(helper, /profile\.phone_display/);
assert.match(helper, /profile\.whatsapp_number/);
assert.match(helper, /profile\.whatsapp_url/);
assert.match(helper, /profile\.address/);
assert.doesNotMatch(helper, /profile\.phone\b|profile\.whatsapp_phone\b/, "legacy/private phone fields must not be treated as public");
assert.match(helper, /wa\.me/);
assert.match(helper, /api\.whatsapp\.com/);
assert.doesNotMatch(storefront, /\.select\(["']id,name,code,status,address,phone["']\)/);
assert.doesNotMatch(directory, /\.select\(["']id,name,code,status,address,phone["']\)/);
assert.doesNotMatch(storefront, /selectedBranch\.phone|branch\.phone|branch\.address/);
assert.doesNotMatch(directory, /branch\?\.phone|branch\?\.address|entry\.phone|entry\.address/);
assert.match(storefront, /contactPhone: publicContact\.phoneDisplay \|\| publicContact\.whatsappNumber/);
assert.match(directory, /contactPhone: publicContact\.phoneDisplay \|\| publicContact\.whatsappNumber/);
assert.match(mapper, /const isPublicProjection = \["PUBLIC_READ_ONLY", "PUBLIC_DIRECTORY_READ_ONLY"\]/);
assert.match(mapper, /ownerWhatsApp: isPublicProjection \? publicWhatsApp/);
assert.match(mapper, /phone: isPublicProjection \? publicPhone/);
assert.match(mapper, /address: isPublicProjection \? String\(profile\.address \|\| ''\)/);
assert.match(mapper, /accessMode: data\?\.accessMode \|\| "PUBLIC_DIRECTORY_READ_ONLY"/);
assert.match(mapper, /accessMode: body\.accessMode \|\| "PUBLIC_READ_ONLY"/);

console.log("PUBLIC_CATALOG_CONTACT_PRIVACY_STATIC=PASS (19 assertions)");
