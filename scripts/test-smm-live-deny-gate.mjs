#!/usr/bin/env node
import assert from "node:assert/strict";

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const ordinaryUserToken = process.env.SMM_ORDINARY_USER_ACCESS_TOKEN;
const endpoint = process.env.SMM_GATEWAY_URL ||
  (supabaseUrl ? new URL("/functions/v1/smm-gateway", supabaseUrl).toString() : null);

assert.ok(endpoint, "Set SMM_GATEWAY_URL or SUPABASE_URL");
assert.ok(anonKey, "Set SUPABASE_ANON_KEY");
assert.ok(ordinaryUserToken, "Set SMM_ORDINARY_USER_ACCESS_TOKEN to a non-admin test user's access token");

const actions = [
  ["catalog", {}],
  ["my_data", {}],
  ["place_order", {}],
  ["configure_provider", {}],
  ["sync_services", {}],
  ["provider_status", {}],
  ["admin_credit", {}],
  ["admin_data", {}],
  ["set_price", {}],
  ["order_status", {}],
];

async function request(action, token) {
  const headers = {
    "Content-Type": "application/json",
    apikey: anonKey,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ action }),
    signal: AbortSignal.timeout(10000),
  });
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch { body = { raw }; }
  return { status: response.status, body };
}

async function expectDenied(label, action, token) {
  const result = await request(action, token);
  assert.equal(
    result.status,
    503,
    `${label}/${action}: expected HTTP 503 before auth/action dispatch, received HTTP ${result.status}; stopping immediately to avoid probing further against a potentially enabled endpoint`,
  );
  assert.equal(
    result.body?.error,
    "SMM_POST_LAUNCH_DEFERRED",
    `${label}/${action}: expected SMM_POST_LAUNCH_DEFERRED`,
  );
  console.log(`PASS ${label}/${action}: 503 SMM_POST_LAUNCH_DEFERRED`);
}

// Fail-fast order is intentional: if the server-side gate is absent, the first
// unauthenticated request fails the test and no subsequent action probes run.
for (const [action] of actions) {
  await expectDenied("unauthenticated", action, null);
}
for (const [action] of actions) {
  await expectDenied("ordinary-authenticated", action, ordinaryUserToken);
}

console.log("PASS: every tested SMM action is denied before authentication/action dispatch while the feature is deferred.");
console.log("Limit: this script verifies the live HTTP deny contract. Record deployed function version/hash separately and corroborate no side effects using approved read-only database/provider telemetry.");
