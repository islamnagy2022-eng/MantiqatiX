import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261121030000_rc496_mantigo_bid_accept_state_invariant.sql",
  "utf8"
);
const integration = fs.readFileSync(
  "supabase/tests/rc496_mantigo_bid_accept_state_invariant_integration.sql",
  "utf8"
);
const fixture = fs.readFileSync(
  "supabase/tests/rc496_mantigo_bid_accept_state_invariant_fixture.sql",
  "utf8"
);
assert.match(fixture, /CREATE TABLE public\\.mantigo_captain_profiles/);
assert.match(fixture, /UNIQUE \\(ride_id,captain_id\\)/);
const concurrency = fs.readFileSync(
  "scripts/test-rc496-mantigo-bid-accept-concurrency.sh",
  "utf8"
);

const fnStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.accept_mantigo_bid_backend(");
const fnEnd = migration.indexOf("$function$;", fnStart);
assert.ok(fnStart >= 0 && fnEnd > fnStart, "RC496 must replace the exact existing acceptance RPC");
const fn = migration.slice(fnStart, fnEnd);

const createStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.create_mantigo_bid_backend(");
const createEnd = migration.indexOf("$function$;", createStart);
assert.ok(createStart >= 0 && createEnd > createStart, "RC496 must replace the offer creation RPC too");
const createFn = migration.slice(createStart, createEnd);

const lockStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.lock_mantigo_fare_backend(");
const lockEnd = migration.indexOf("$function$;", lockStart);
assert.ok(lockStart >= 0 && lockEnd > lockStart, "RC496 must replace the fare-lock RPC too");
const lockFn = migration.slice(lockStart, lockEnd);

assert.match(createFn, /SET search_path TO ''/i, "SECURITY DEFINER offer writer must have an empty search_path");
assert.match(createFn, /p_user_id IS DISTINCT FROM auth\\.uid\\(\\)/, "offer writer caller must be auth.uid()");
assert.match(createFn, /accepted_bid_id IS NULL/, "offer writer cannot reopen an accepted ride");
assert.match(createFn, /NOT EXISTS \\([\\s\\S]*?status='ACCEPTED'/, "offer writer rejects stale accepted bid rows");
assert.match(createFn, /FOR UPDATE OF r/, "offer writer must lock the ride before changing offers");
assert.match(createFn, /ON CONFLICT \\(ride_id,captain_id\\) DO UPDATE[\\s\\S]*?WHERE public\\.mantigo_bids\\.status IN \\('OFFERED','REJECTED','WITHDRAWN','EXPIRED'\\)/,
  "offer resubmission may only update non-accepted bids");
assert.match(createFn, /BID_ALREADY_ACCEPTED_OR_NOT_REUSABLE/);
assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS mantigo_bids_one_accepted_per_ride_idx[\\s\\S]*?WHERE status='ACCEPTED'/);
assert.match(fn, /SET search_path TO ''/i, "SECURITY DEFINER acceptance RPC must have an empty search_path");
assert.match(fn, /p_user_id IS DISTINCT FROM auth\.uid\(\)/, "caller identity must be bound to auth.uid()");
assert.match(fn, /FROM public\.mantigo_rides r[\s\S]*?FOR UPDATE;/, "ride row must be locked before reading acceptance state");
assert.match(fn, /FROM public\.mantigo_bids b[\s\S]*?FOR UPDATE;/, "selected bid row must be locked");
assert.match(fn, /v_bid_status IS DISTINCT FROM 'OFFERED'[\s\S]*?BID_NOT_OFFERED/, "only an OFFERED bid can be accepted");
assert.match(fn, /WHERE id=p_bid_id AND ride_id=p_ride_id AND status='OFFERED'/, "selected bid UPDATE must be conditional on OFFERED");
assert.match(fn, /GET DIAGNOSTICS v_rows = ROW_COUNT[\s\S]*?BID_ACCEPTANCE_RACE_LOST/, "state transition must check exact row count");
assert.match(fn, /WHERE ride_id=p_ride_id AND status='OFFERED' AND id<>p_bid_id/, "only other OFFERED bids may be rejected");
assert.match(fn, /accepted_bid_id IS NULL/, "an existing winner cannot be replaced");
assert.match(fn, /b\.status='ACCEPTED'[\s\S]*?RIDE_ACCEPTANCE_STATE_MISMATCH/, "a stale accepted bid must block a second winner when ride state is inconsistent");
assert.match(fn, /public\.lock_mantigo_fare_backend\(p_user_id,p_ride_id\)/, "fare lock must be called after winner persistence");
assert.match(fn, /v_status='ACCEPTED' AND v_accepted_bid_id=p_bid_id[\s\S]*?idempotent',true/, "same winning bid retry must be idempotent");
assert.match(migration, /REVOKE ALL ON FUNCTION public\.accept_mantigo_bid_backend\(uuid,text,text\) FROM PUBLIC,anon/i);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.accept_mantigo_bid_backend\(uuid,text,text\) TO authenticated/i);
assert.match(lockFn, /SET search_path TO ''/i, "fare-lock SECURITY DEFINER RPC must use an empty search_path");
assert.match(lockFn, /v_existing\.customer_id IS DISTINCT FROM v_customer/);
assert.match(lockFn, /v_existing\.captain_id IS DISTINCT FROM v_captain/);
assert.match(lockFn, /v_existing\.currency IS DISTINCT FROM 'EGP'/);
assert.match(lockFn, /v_existing\.gross_amount IS DISTINCT FROM v_amount/);
assert.match(lockFn, /count\(\*\)[\s\S]*?status='ACCEPTED'[\s\S]*?RIDE_ACCEPTANCE_STATE_MISMATCH/);
assert.match(lockFn, /v_existing\.idempotency_key IS DISTINCT FROM v_key/);
assert.match(lockFn, /metadata->>'accepted_bid_id'/);
assert.match(lockFn, /MANTIGO_FINANCIAL_IDENTITY_MISMATCH/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.mantigo_accept_bid\(text,text\) FROM PUBLIC,anon,authenticated/i);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.mantigo_submit_bid\(text,numeric,text,text,text,text\) FROM PUBLIC,anon,authenticated/i);

for (const state of ["ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"]) {
  assert.ok(integration.includes(`ARRAY['RC496-${state}','RC496-SELECT-${state}']`),
    `integration must reject selected bid state ${state}`);
}
assert.match(integration, /RC496-SUBMIT/);
assert.match(integration, /offer resubmission did not safely revise/);
assert.match(integration, /RIDE_NOT_OPEN_OR_VEHICLE_MISMATCH/);
assert.match(integration, /RC496_ONE_ACCEPTED_BID_INDEX_MISSING/);
assert.match(integration, /CREATE-BID_SEARCH_PATH_MISMATCH/);
assert.match(integration, /RC496-WINNER/);
assert.match(integration, /RC496-SIBLING/);
assert.match(integration, /idempotent/);
assert.match(integration, /RC496_TEST_FARE_LOCK_FAILURE/);
assert.match(integration, /MANTIGO_FINANCIAL_IDENTITY_MISMATCH/);
assert.match(integration, /RC496-LEDGER-MISMATCH/);
assert.match(integration, /RC496-DUPLICATE-WINNER/);
assert.match(integration, /mantigo_financial_ledger/);
assert.match(fixture, /CREATE TABLE public\.mantigo_financial_ledger/);
assert.match(fixture, /CREATE TRIGGER rc496_fail_fare_lock_before_insert/);
assert.match(integration, /fare-lock failure left a partial acceptance/);
assert.match(integration, /CUSTOMER_REQUIRED/);
assert.match(integration, /USER_CONTEXT_MISMATCH/);
assert.match(integration, /CREATE TRIGGER rc496_delay_accept_update/);
assert.match(concurrency, /success_count/);
assert.match(concurrency, /denied_count/);
assert.match(concurrency, /RIDE_NOT_OPEN/);
assert.match(concurrency, /one winner/i);
assert.match(concurrency, /RC496-CONCURRENT/);

console.log("RC496 MantiGO bid acceptance state-invariant contract PASS.");
