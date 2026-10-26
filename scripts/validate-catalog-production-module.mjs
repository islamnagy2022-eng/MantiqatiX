#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const checks = [];
const check = (name, fn) => {
  try { fn(); checks.push({ name, status: "PASS" }); }
  catch (error) {
    checks.push({ name, status: "FAIL", error: String(error?.message || error) });
  }
};
const includes = (source, text, message = `missing required contract: ${text}`) =>
  assert.ok(source.includes(text), message);
const excludes = (source, regex, message) =>
  assert.ok(!regex.test(source), message || `forbidden content found: ${regex}`);

const page = read("web/catalog/index.html");
const publicJs = read("web/catalog/catalog.js");
const publicCss = read("web/catalog/catalog.css");
const moduleJs = read("web/catalog-module.js");
const app = read("web/app.js");
const rbac = read("web/rbac.js");
const reactApp = read("apps/catalog-frontend/src/App.tsx");
const appContext = read("apps/catalog-frontend/src/context/AppContext.tsx");
const adminFn = read("supabase/functions/catalog-admin/index.ts");
const publicFn = read("supabase/functions/public-catalog/index.ts");
const migration = read("supabase/migrations/20261026092940_rc107_catalog_manager_business_branch_scope.sql");
const supabaseConfig = read("supabase/config.toml");
const workflow = read(".github/workflows/pages.yml");

check("production_entry_loads_catalog_module", () => {
  includes(read("web/index.html"), "catalog-module.js?v=rc107-catalog-production");
  includes(read("web/index.html"), "config.js");
});
check("existing_google_oauth_unchanged", () => {
  includes(app, "signInWithGoogle");
  includes(app, "id=\"google-auth\"");
  excludes(app, /signInWithPassword|signInWithOtp|verifyOtp/, "the production app must not be changed to DEMO password auth");
  includes(app, "MNTYCatalogModule");
});
check("module_is_separate_and_role_gated", () => {
  includes(app, "['📦','كتالوج النشاط','إدارة الكتالوج العام للمنتجات والخدمات والأسعار']");
  includes(app, "window.MNTYCatalogModule.render");
  includes(app, "window.MNTYCatalogModule?.bind()");
  includes(app, "m[1]!=='كتالوج النشاط'||['SUPER_ADMIN','OWNER','BUSINESS_OWNER','ADMIN','MANAGER']");
  includes(app, "'كتالوج النشاط':['CATALOG']");
  includes(rbac, "'كتالوج النشاط':'CATALOG'");
  for (const role of ["OWNER", "BUSINESS_OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN"]) includes(rbac, role);
});
check("module_writes_only_through_authenticated_edge_function", () => {
  includes(moduleJs, "/functions/v1/catalog-admin");
  includes(moduleJs, '"Authorization": "Bearer " + session.access_token');
  includes(moduleJs, 'action: "ITEM_PRICE_UPSERT"');
  includes(moduleJs, 'action: "BUSINESS_PROFILE_UPSERT"');
  includes(moduleJs, 'action: "ITEM_STATUS_UPDATE"');
  excludes(moduleJs, /localStorage|sessionStorage|signInWithPassword|signInWithOAuth|password/,
    "catalog module must reuse the current auth session and must not implement another login");
});
check("public_catalog_is_read_only_and_opt_in", () => {
  includes(publicFn, 'business.settings?.catalog_public_enabled !== true');
  includes(publicFn, '"PUBLIC_READ_ONLY"');
  includes(publicFn, "paymentsEnabled: false");
  assert.ok(publicFn.indexOf("const stockAvailability = new Map<string, boolean>()") < publicFn.indexOf("const items = (rawItems || []).map"), "stock availability must be resolved before public item mapping");
  includes(publicFn, '.eq("business_id", businessId)');
  includes(publicFn, '.eq("status", "ACTIVE")');
  includes(publicFn, '.is("branch_id", null)');
  includes(publicFn, '.eq("branch_id", branchId)');
  excludes(publicFn, /from\("user_memberships"\)|from\("orders"\)|from\("medical_appointments"\)/,
    "public catalog must not read memberships, orders, or appointments");
});
check("public_page_escapes_content_and_uses_whatsapp_only", () => {
  includes(page, "catalog-order-dialog");
  includes(publicJs, "escapeHtml");
  includes(publicJs, "https://wa.me/");
  includes(publicJs, "لا يوجد دفع إلكتروني");
  includes(publicJs, "navigator.share");
  excludes(publicJs, /from\(['"](?:catalog_items|catalog_item_prices|businesses)['"]\)\.(?:insert|update|delete)/,
    "public page must not mutate catalog tables directly");
  includes(publicCss, ".catalog-cart-bar");
});
check("database_writes_enforce_business_branch_and_limits", () => {
  includes(migration, "CATALOG_WRITE_FORBIDDEN");
  includes(migration, "BRANCH_BUSINESS_MISMATCH");
  includes(migration, "CATALOG_ITEM_NOT_FOUND");
  includes(migration, "CATALOG_ITEM_LIMIT_REACHED");
  includes(migration, "pg_advisory_xact_lock");
  includes(migration, "upsert_catalog_item_and_price_backend");
  includes(migration, "update_catalog_item_status_backend");
  const statusFunctionStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.update_catalog_item_status_backend(");
  const statusFunctionEnd = migration.indexOf("CREATE OR REPLACE FUNCTION public.upsert_catalog_business_profile_backend(", statusFunctionStart);
  const statusFunction = migration.slice(statusFunctionStart, statusFunctionEnd);
  includes(statusFunction, "IF v_status = 'ACTIVE'");
  includes(statusFunction, "CATALOG_ITEM_LIMIT_REACHED");
  includes(statusFunction, "pg_advisory_xact_lock");
  includes(migration, "upsert_catalog_business_profile_backend");
  includes(migration, "REVOKE ALL ON FUNCTION");
  includes(migration, "FROM PUBLIC, anon");
  includes(migration, "upper(m.role::text) = 'OWNER' AND m.business_id IS NULL");
});
check("react_privileged_views_require_authorized_session", () => {
  includes(reactApp, "currentView === 'super_admin' && authSession.role !== 'admin'");
  includes(reactApp, "!['subscriber', 'admin'].includes(authSession.role) || !currentBusiness");
  includes(reactApp, "{visibleView === 'merchant_admin' && <MerchantDashboard />}");
  includes(reactApp, "{visibleView === 'super_admin' && <AdminDashboard />}");
  includes(appContext, "return businesses.find((b) => b.id === authSession.businessId);");
});
check("edge_function_auth_and_tenant_selection", () => {
  includes(adminFn, 'auth.getUser(token)');
  includes(adminFn, "BUSINESS_LIST");
  includes(adminFn, "CATALOG_READ");
  includes(adminFn, "ITEM_PRICE_UPSERT");
  includes(adminFn, "ITEM_STATUS_UPDATE");
  includes(adminFn, "BUSINESS_PROFILE_UPSERT");
  includes(adminFn, "tenantOwnerScope");
  includes(adminFn, "BRANCH_SCOPE_FORBIDDEN");
  excludes(adminFn, /SUPABASE_SERVICE_ROLE_KEY.{0,120}return out\(origin,\s*\{[^}]*serviceRole/i,
    "the service-role secret must never be returned to the browser");
});
check("public_endpoint_jwt_exception_is_explicit", () => {
  includes(supabaseConfig, "[functions.public-catalog]");
  includes(supabaseConfig, "verify_jwt = false");
  includes(workflow, "node --check web/catalog-module.js");
  includes(workflow, "node --check web/catalog/catalog.js");
  includes(workflow, "validate-catalog-production-module.mjs");
});

const failed = checks.filter((x) => x.status === "FAIL");
for (const item of checks) {
  console.log((item.status === "PASS" ? "PASS" : "FAIL") + " " + item.name + (item.error ? ": " + item.error : ""));
}
console.log(`Catalog module contract: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
