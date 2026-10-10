import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20261010160000_rc448_financial_journal_service_role_boundary.sql",
  "utf8",
);
const edge = fs.readFileSync("supabase/functions/financial-journal/index.ts", "utf8");
const backendEdge = fs.readFileSync("supabase/functions/post-financial-journal/index.ts", "utf8");

assert.match(migration, /set search_path = public, pg_temp/i, "SECURITY DEFINER search_path must pin pg_temp last");
assert.match(
  migration,
  /current_setting\('request\.jwt\.claim\.role', true\)/i,
  "service-role exception must read the verified JWT role claim",
);
assert.match(migration, /p_user_id <> auth\.uid\(\)/i, "non-service callers must bind the actor to auth.uid");
assert.match(migration, /um\.user_id=p_user_id[\s\S]*?um\.status='ACTIVE'/i, "actor must have an ACTIVE membership");
assert.match(migration, /um\.business_id is null or um\.business_id=v_business_id/i, "business-scoped memberships must not cross businesses");
assert.match(migration, /um\.branch_id is null or um\.branch_id=v_branch_id/i, "branch-scoped memberships must not cross branches");
assert.match(migration, /BUSINESS_NOT_ACTIVE_FOR_TENANT/);
assert.match(migration, /to_regclass\('public[.]businesses'\)[\s\S]*?to_regclass\('public[.]branches'\)/i, "business and branch schema must exist before migration");
assert.match(migration, /v_org_id := coalesce\(v_org_id,v_business_org_id\)/i, "business organization must be derived and bound when omitted");
assert.match(migration, /BUSINESS_ORGANIZATION_MISMATCH/);
assert.match(migration, /BRANCH_NOT_ACTIVE_FOR_BUSINESS/);
assert.match(migration, /FINANCIAL_MEMBERSHIP_REQUIRED/, "financial role check must fail closed");
assert.match(migration, /v_insert_line_no int := 0/, "journal line numbering must use a per-line counter");
assert.match(migration, /v_insert_line_no := v_insert_line_no \+ 1;/, "each inserted line must advance the line counter");
assert.match(migration, /now\(\),p_user_id\);\s+for v_line/i, "journal header INSERT must terminate before line iteration");
assert.match(migration, /v_line->>'description'\);\s+end loop;/i, "journal line INSERT must terminate before the loop ends");
assert.match(migration, /coalesce\(\(v_line->>'line_number'\)::int,v_insert_line_no\)/, "missing line numbers must default to the actual ordinal, not the total line count");
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(v_id, 0\)\)/, "journal ID operations must serialize under concurrent retries");
assert.match(migration, /JOURNAL_ID_ALREADY_EXISTS/, "replayed journal IDs must fail closed instead of silently mixing lines");
assert.doesNotMatch(migration, /on conflict\(id\) do nothing/i, "journal header/line inserts must not silently ignore ID conflicts");
assert.match(migration, /revoke all on function public\.post_financial_journal_backend\(uuid,jsonb,jsonb\) from public, anon, authenticated/i, "RPC must remain unavailable to direct client roles");
assert.match(migration, /grant execute on function public\.post_financial_journal_backend\(uuid,jsonb,jsonb\) to service_role/i, "trusted Edge Function role must be able to execute RPC");

assert.match(edge, /admin\.auth\.getUser\(token\)/, "Edge Function must verify the bearer token");
assert.match(edge, /user\.is_anonymous/, "anonymous sessions must be rejected");
assert.match(edge, /admin\.rpc\(["']post_financial_journal_backend["']/i, "Edge Function must use the actor-checked backend RPC");
assert.match(edge, /p_user_id:\s*user\.id/, "verified actor identity must be supplied to the RPC");
assert.doesNotMatch(edge, /rpc\(["']post_financial_journal["']/i, "legacy auth.uid-only RPC must not be called");
assert.doesNotMatch(edge, /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/i, "wildcard browser CORS is forbidden");
assert.match(edge, /ORIGIN_NOT_ALLOWED/, "unapproved browser origins must be rejected");

assert.match(backendEdge, /admin\.rpc\(["']post_financial_journal_backend["']/i, "canonical endpoint must call the backend RPC");
assert.match(backendEdge, /p_user_id:\s*auth\.user\.id/, "canonical endpoint must pass its verified actor");
assert.match(integration, /same-tenant cross-business actor unexpectedly succeeded/);
assert.match(integration, /branch-scoped actor unexpectedly posted to another branch/);
assert.match(integration, /organization mismatch unexpectedly succeeded/);
console.log("RC448 financial journal service-role boundary PASS");
