import fs from "node:fs";

const rc449 = fs.readFileSync("supabase/migrations/20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql", "utf8");
const rc462 = fs.readFileSync("supabase/migrations/20261031064300_rc462_platform_admin_registry_authority_convergence.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc449_mantigo_platform_admin_integration.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc449_mantigo_platform_admin_fixture.sql", "utf8");
const checks = [];
function check(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
  if (!ok) console.error("FAIL " + name);
}

const guardStart = rc462.indexOf("create or replace function public.mnty_can_platform_admin()");
const guardEnd = rc462.indexOf("$function$;", guardStart);
const guardBody = guardStart >= 0 && guardEnd > guardStart ? rc462.slice(guardStart, guardEnd) : "";

check("RC449 historical migration still creates all four guarded global MantiGO RPCs",
  rc449.includes("get_mantigo_admin_dashboard_backend") &&
  rc449.includes("get_mantigo_admin_financial_report_backend") &&
  rc449.includes("settle_mantigo_captain_backend") &&
  rc449.includes("expire_stale_mantigo_rides_backend") &&
  (rc449.match(/if not public\.mnty_can_platform_admin\(\)/g) || []).length >= 4);
check("RC462 uses the canonical private platform-admin registry bound to auth.uid",
  guardBody.includes("from private.platform_admins") &&
  guardBody.includes("pa.user_id = auth.uid()") &&
  !guardBody.includes("from public.user_memberships"));
check("RC462 guard remains SECURITY DEFINER with empty search_path and narrow ACL",
  guardBody.includes("security definer") &&
  guardBody.includes("set search_path = ''") &&
  rc462.includes("revoke all on function public.mnty_can_platform_admin() from public, anon") &&
  rc462.includes("grant execute on function public.mnty_can_platform_admin() to authenticated"));
check("RC462 preflight refuses to run before all four RC449 MantiGO RPC guards exist",
  rc462.includes("RC462_REQUIRES_RC449_GLOBAL_RPC_GUARDS") &&
  rc462.includes("v_guarded_rpc_count <> 4") &&
  rc462.includes("private.platform_admins"));

const additionalGuardSources = [
  "supabase/migrations/20261002123500_rc258_use_central_rbac_admin_ad.sql",
  "supabase/migrations/20261006121734_digital_page_fulfillment_publish_gate_v1.sql",
  "supabase/migrations/20261006144500_mantigo_captain_onboarding_v1.sql",
  "supabase/migrations/20261006152000_mantigo_financial_ledger_v1.sql"
].map((path) => fs.readFileSync(path, "utf8"));
check("the four additional platform-global SECURITY DEFINER callers all use the shared guard",
  additionalGuardSources.every((source) => source.includes("mnty_can_platform_admin()")));

check("integration rejects tenant OWNER, ADMIN and OPERATIONS_MANAGER",
  integration.includes("tenant OWNER must not be treated") &&
  integration.includes("tenant ADMIN with admin permission") &&
  integration.includes("tenant OPERATIONS_MANAGER"));
check("integration rejects platform membership without a private registry entry",
  integration.includes("MNTY-PLATFORM membership without private registry entry must be denied") &&
  integration.includes("MNTY-PLATFORM membership without registry"));
check("integration permits a registry-only platform admin without tenant membership",
  integration.includes("private registry platform admin without tenant membership should pass") &&
  integration.includes("registry-only platform admin could not read MantiGO dashboard"));
check("integration verifies platform authority is revoked when the registry row is removed",
  integration.includes("removed platform registry entry retained platform authority"));
check("integration exercises all four global MantiGO RPCs for unauthorized actors",
  integration.includes("assert_mantigo_global_rpcs_denied") &&
  integration.includes("accessed global MantiGO dashboard") &&
  integration.includes("accessed global MantiGO financial report") &&
  integration.includes("reached global MantiGO settlement") &&
  integration.includes("reached global MantiGO ride expiration"));
check("integration retains anonymous denial and authenticated RPC entrypoint grants",
  integration.includes("anon must not execute platform ride expiration") &&
  integration.includes("authenticated role must retain intended RPC entrypoint grants") &&
  integration.includes("has_function_privilege('authenticated','public.expire_stale_mantigo_rides_backend(uuid,integer)','EXECUTE')"));
check("integration verifies SECURITY DEFINER empty search_path on all four global RPCs",
  integration.includes("MANTIGO_DEFINER_CONFIG_FAILED") &&
  integration.includes("array['search_path=\"\"']") &&
  integration.includes("expected four SECURITY DEFINER RPCs with empty search_path"));
check("fixture models private.platform_admins and denies client table access",
  fixture.includes("create schema if not exists private") &&
  fixture.includes("create table private.platform_admins") &&
  fixture.includes("revoke all on table private.platform_admins from public,anon,authenticated"));
check("fixture reproduces digital_pages platform-admin RLS policy and authenticated table grants",
  fixture.includes("create policy digital_pages_admin_manage") &&
  fixture.includes("enable row level security") &&
  fixture.includes("grant select,insert,update,delete on public.digital_pages to authenticated"));
check("integration denies tenant OWNER global digital_pages CRUD and permits registry admins",
  integration.includes("tenant OWNER read global digital_pages rows") &&
  integration.includes("tenant OWNER updated global digital_pages") &&
  integration.includes("tenant OWNER deleted global digital_pages") &&
  integration.includes("tenant OWNER inserted global digital_pages") &&
  integration.includes("platform SUPER_ADMIN could not read global digital_pages") &&
  integration.includes("registry-only platform admin could not read global digital_pages"));

const failed = checks.filter((x) => !x.ok);
if (failed.length) process.exit(1);
console.log("MantiGO platform-admin registry convergence contract PASS: " + checks.length + "/" + checks.length + " checks.");
