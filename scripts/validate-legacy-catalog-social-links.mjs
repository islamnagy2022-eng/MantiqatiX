#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const ownerModule = fs.readFileSync("web/catalog-module.js", "utf8");
const publicPage = fs.readFileSync("web/catalog/catalog.js", "utf8");
const publicHtml = fs.readFileSync("web/catalog/index.html", "utf8");
const publicCss = fs.readFileSync("web/catalog/catalog.css", "utf8");
const adminFunction = fs.readFileSync("supabase/functions/catalog-admin/index.ts", "utf8");
const publicFunction = fs.readFileSync("supabase/functions/public-catalog/index.ts", "utf8");

for (const [label, id] of [
  ["Facebook", "mx-cat-profile-facebook"],
  ["Instagram", "mx-cat-profile-instagram"],
  ["TikTok", "mx-cat-profile-tiktok"],
]) {
  assert.ok(ownerModule.includes('id="' + id + '"'), label + " URL must be editable by the authorized activity owner.");
  assert.ok(ownerModule.includes(id + '").value.trim()'), label + " URL must be sent when saving the owner profile.");
}
for (const field of ["facebookUrl", "instagramUrl", "tiktokUrl"]) {
  assert.ok(ownerModule.includes(field + ": content.querySelector"), "Owner form must persist " + field);
  assert.ok(publicFunction.includes(field + ": String(profile."), "Public catalog must return " + field);
}
assert.ok(adminFunction.includes("INVALID_SOCIAL_PROFILE_URL"), "Backend must reject social links outside their platform allowlist.");
assert.ok(publicPage.includes('url.protocol !== "https:"'), "Social destinations must require HTTPS.");
for (const host of ["facebook.com", "instagram.com", "tiktok.com"]) {
  assert.ok(publicPage.includes(host), "Public social URL allowlist must include " + host);
}
for (const id of ["business-social-links", "phone-link"]) {
  assert.ok(publicHtml.includes('id="' + id + '"'), "Public page must have the " + id + " target.");
}
assert.ok(publicPage.includes('phoneLink.href = "tel:" + dialPhone'), "The phone action must open the device dialer.");
assert.ok(publicPage.includes("link.href = url"), "Social links must navigate to the validated profile URL.");
assert.ok(publicPage.includes('link.target = "_blank"') && publicPage.includes('link.rel = "noopener noreferrer"'), "Social links must open safely.");
assert.ok(publicCss.includes(".catalog-social-actions") && publicCss.includes(".catalog-btn-phone"), "Contact action styling must be present.");
assert.ok(publicHtml.includes("rc108-social-links"), "Updated public assets must use a new cache-busting version.");

console.log("Legacy catalog social links and click-to-call validation passed.");
