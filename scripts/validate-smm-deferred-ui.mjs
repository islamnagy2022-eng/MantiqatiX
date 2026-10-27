import fs from "node:fs";
import assert from "node:assert/strict";

const page = fs.readFileSync("web/smm.html", "utf8");
const gateway = fs.readFileSync("supabase/functions/smm-gateway/index.ts", "utf8");

assert.equal(fs.existsSync("web/smm.js"), false, "The retired interactive SMM client must not return.");
assert.equal(fs.existsSync("web/smm.css"), false, "The retired SMM storefront stylesheet must not return.");
assert.match(page, /<meta name="robots" content="noindex,follow">/i,
  "The deferred SMM page must remain excluded from search indexing.");
assert.match(page, /خارج نطاق الإطلاق الأول/,
  "The SMM page must clearly identify the initial-launch deferral.");
assert.match(page, /الخدمة غير متاحة للطلبات حاليًا/,
  "The SMM page must tell customers that orders are unavailable.");
assert.match(page, /التسويق والإعلان/,
  "The page must direct customers to the separate Marketing & Advertising module.");
assert.doesNotMatch(page, /<script\b|<form\b|smm-gateway|smm_services|smm_orders|smm_wallets|google-auth/i,
  "The placeholder must not reintroduce the retired interactive storefront or API calls.");

assert.match(gateway, /const SMM_INITIAL_LAUNCH_DEFERRED=true/,
  "SMM execution must remain deferred in the server-side gateway source.");
assert.match(gateway, /SMM_DEFERRED/,
  "The gateway must retain an explicit fail-closed response for the deferred launch.");
assert.ok(fs.existsSync("scripts/validate-smm-service-role-boundary.mjs"),
  "Retain the server-side SMM authorization and least-privilege contract test.");
assert.ok(fs.existsSync("supabase/migrations/20261011010000_rc456_smm_service_role_access_boundary.sql"),
  "Retain the historical SMM privilege migration; frontend retirement must not rewrite DB history.");

console.log("SMM deferred storefront contract: PASS (placeholder, no interactive client, server gate retained).");
