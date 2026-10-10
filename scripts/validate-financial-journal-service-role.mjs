import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261010160000_rc448_financial_journal_service_role_boundary.sql", "utf8");
const edge = fs.readFileSync("supabase/functions/financial-journal/index.ts", "utf8");
const backendEdge = fs.readFileSync("supabase/functions/post-financial-journal/index.ts", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc448_financial_journal_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc448_financial_journal_integration.sql", "utf8");

assert.match(migration, /set search_path = public, pg_temp/i, "SECURITY DEFINER search_path must pin pg_temp last");
assert.match(migration, /current_setting\('request\.jwt\.claim\.role', true\)/i, "service-role exception must read the verified JWT role claim");
assert.match(migration, /p_user_id <> auth\.uid\(\)/i, "non-service callers must bind the actor to auth.uid");
assert.match(migration, /um\.user_id=p_user_id[\s\S]*?um\.status='ACTIVE'/i, "actor must have an ACTIVE membership");
assert.match(migration, /um\.business_id is null or um\.business_id=v_business_id/i, "business-scoped memberships must not cross businesses");
assert.match(migration, /um\.branch_id is null or um\.branch_id=v_branch_id/i, "branch-scoped memberships must not cross branches");
assert.match(migration, /BUSINESS_NOT_ACTIVE_FOR_TENANT/);
assert.match(migration, /BRANCH_NOT_ACTIVE_FOR_BUSINESS/);
assert.match(migration, /BUSINESS_ORGANIZATION_MISMATCH/);
assert.match(migration, /v_org_id := coalesce\(v_org_id,v_business_org_id\)/i, "business organization must be derived and bound when omitted");
assert.match(migration, /to_regclass\('public\.businesses'\)[\s\S]*?to_regclass\('public\.branches'\)/i, "business and branch schema must exist before migration");
assert.match(migration, /FINANCIAL_MEMBERSHIP_REQUIRED/);
assert.match(migration, /v_insert_line_no int := 0/);
assert.match(migration, /v_insert_line_no := v_insert_line_no \+ 1;/);
assert.match(migration, /coalesce\(\(v_line->>'line_number'\)::int,v_insert_line_no\)/);
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(v_id, 0\)\)/, "journal IDs must serialize under retries");
assert.match(migration, /JOURNAL_ID_ALREADY_EXISTS/);
assert.doesNotMatch(migration, /on conflict\(id\) do nothing/i);
assert.match(migration, /'DRAFT',v_total_debit[\s\S]*?clock_timestamp\(\),p_user_id\)/i, "header must start DRAFT while lines are inserted");
assert.match(migration, /update public\.journal_entries[\s\S]*?set status='POSTED',posted_at=clock_timestamp\(\)/i, "posting must occur only after lines are inserted");
assert.match(migration, /JOURNAL_POST_TRANSITION_FAILED/);
assert.match(migration, /create or replace function public\.trg_post_journal_to_general_ledger/i);
assert.match(migration, /pg_advisory_xact_lock[\s\S]*?hashtextextended\(new\.tenant_id \|\| ':' \|\| v_account, 0\)/i, "account balances must serialize by tenant and account");
assert.match(migration, /v_account_balances jsonb := '\{\}'::jsonb/i, "same-account lines must accumulate in order");
assert.doesNotMatch(migration, /jel\.debit-jel\.credit/, "running balance must not be reduced to the current line net");
assert.match(migration, /revoke all on function public\.post_financial_journal_backend\(uuid,jsonb,jsonb\) from public, anon, authenticated/i);
assert.match(migration, /grant execute on function public\.post_financial_journal_backend\(uuid,jsonb,jsonb\) to service_role/i);

assert.match(edge, /admin\.auth\.getUser\(token\)/);
assert.match(edge, /user\.is_anonymous/);
assert.match(edge, /admin\.rpc\(["']post_financial_journal_backend["']/i);
assert.match(edge, /p_user_id:\s*user\.id/);
assert.doesNotMatch(edge, /rpc\(["']post_financial_journal["']/i);
assert.doesNotMatch(edge, /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/i);
assert.match(edge, /ORIGIN_NOT_ALLOWED/);
assert.match(backendEdge, /admin\.rpc\(["']post_financial_journal_backend["']/i);
assert.match(backendEdge, /p_user_id:\s*auth\.user\.id/);

assert.match(fixture, /trg_journal_line_immutability/);
assert.match(fixture, /trg_validate_journal_balance/);
assert.match(integration, /same-tenant cross-business actor unexpectedly succeeded/);
assert.match(integration, /branch-scoped actor unexpectedly posted to another branch/);
assert.match(integration, /organization mismatch unexpectedly succeeded/);
assert.match(integration, /running balances are not cumulative/);

console.log("RC448 financial journal service-role boundary PASS");
