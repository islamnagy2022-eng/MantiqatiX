import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync("web/app.js", "utf8");
const home = fs.readFileSync("web/home.js", "utf8");

const required = [
  ["Google OAuth primary", "sb.auth.signInWithOAuth({provider:'google',options:", app],
  ["Secure OAuth redirect", "function oauthRedirectUrl(){return window.location.origin+window.location.pathname", app],
  ["Main Google sign-in", "sb.auth.signInWithOAuth({provider:'google',options:", app],
  ["Main email OTP removed", "signInWithOtp(", app, true],
  ["Main OTP verification removed", "verifyOtp(", app, true],
  ["Session verification", "session?.user", app],
  ["Registration request path", "submitRegistrationRequest", app],
  ["Customer direct activation", "sb.functions.invoke('mnty-customer-registration'", app],
  ["Customer direct activation tenant", "tenant_id:'MNTY-PLATFORM'", app],
  ["Additional membership roles", "['CUSTOMER','SERVICE_PROVIDER']", app],
  ["Duplicate pending protection", ".in('status',['PENDING','APPROVED'])", app],
  ["Additional membership UI", "request-service_provider", app],
  ["Membership gate", "if(!live.memberships.length){membershipRequiredView();return}", app],
  ["Logout state reset", "live.memberships=[]", app],
  ["Registration review Edge Function", "sb.functions.invoke('mnty-registration-review'", app],
  ["Admin role guard", "['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase())", app],
  ["Role switcher", 'id="mx-role-switcher"', app],
  ["Membership switch authority", "live.memberships.find(m=>m.id===membershipId&&m.status==='ACTIVE')", app],
  ["Role switch persistence", "localStorage.setItem('MNTYActiveMembershipId',membershipId)", app],
  ["Platform to public home", "id=\"go-public-home\"", app],
  ["Public home to platform", "typeof openPlatform==='function'?openPlatform():goLogin()", fs.readFileSync("web/home.js", "utf8")],
  ["No duplicate customer return control", "id=\"mx-customer-return\"", app, true],
  ["Role labels", "BUSINESS_OWNER:'مالك نشاط'", app],
  ["Role labels", "SUPPORT_MANAGER:'مدير الدعم'", app],
  ["Role labels", "SERVICE_PROVIDER:'صاحب نشاط / مقدم خدمة'", app],
  ["No direct membership insert", ".from('user_memberships').insert", app, true],
  ["No direct membership update", ".from('user_memberships').update", app, true],
  ["No direct membership delete", ".from('user_memberships').delete", app, true],
  ["No direct registration review update", ".from('account_registration_requests').update", app, true]
];

const failures = [];
const bootStart = app.indexOf("async function bootAuth(){");
const bootEnd = app.indexOf("async function renderApp()", bootStart);
const bootAuth = bootStart >= 0 && bootEnd > bootStart ? app.slice(bootStart, bootEnd) : "";
if (bootAuth.includes("sb.auth.signOut()")) failures.push("Automatic boot must not sign out");
const signOutMatches = [...app.matchAll(/sb\.auth\.signOut\(\)/g)];
if (signOutMatches.length !== 1) failures.push("Explicit logout is the only sign-out path");

for (const [name, marker, source, forbidden] of required) {
  const present = source.includes(marker);
  if (forbidden ? present : !present) failures.push(name);
}

const migration = fs.readFileSync("supabase/migrations/20260927150000_owner_role_switch_memberships.sql", "utf8");
for (const role of ["ADMIN","MANAGER","BUSINESS_OWNER","SUPPORT","SUPPORT_MANAGER","EMPLOYEE","STAFF","CUSTOMER","SERVICE_PROVIDER"]) {
  if (!migration.includes(`('${role}')`)) failures.push(`Owner role context: ${role}`);
}
if (/cross join[\s\S]*SUPER_ADMIN/i.test(migration) || /values\s*\([\s\S]*['"]SUPER_ADMIN['"]/i.test(migration)) failures.push("Owner role contexts must not bootstrap SUPER_ADMIN");

// The account activity label must always follow the authenticated user's selected,
// active business membership. Never infer the activity from the owner's latest profile.
const homeAuthStart = home.indexOf("const syncHomeAuthState = async () =>");
const homeAuthEnd = home.indexOf("\n    };", homeAuthStart);
const homeAuth = homeAuthStart >= 0 && homeAuthEnd > homeAuthStart
  ? home.slice(homeAuthStart, homeAuthEnd)
  : "";
if (!homeAuth.includes(".eq('id',selectedMembershipId).eq('user_id',authUser.id).eq('status','ACTIVE')")) {
  failures.push("Homepage activity label must resolve the selected active membership for the signed-in user");
}
if (!homeAuth.includes(".eq('owner_user_id',authUser.id).eq('business_id',businessId).eq('status','ACTIVE')")) {
  failures.push("Homepage provider profile must be scoped to the selected membership business");
}
if (!homeAuth.includes("(activityName||name)")) {
  failures.push("Homepage must fall back to the account name when no selected activity is available");
}

// The account workspace uses that same selected membership; an invalid stored selection
// is cleared rather than silently switching to another owned business.
const liveDataStart = app.indexOf("async function loadLiveData(){");
const liveDataEnd = app.indexOf("const financeRoles=", liveDataStart);
const liveData = liveDataStart >= 0 && liveDataEnd > liveDataStart
  ? app.slice(liveDataStart, liveDataEnd)
  : "";
if (!liveData.includes("live.memberships.find(m=>m.id===savedId)")) {
  failures.push("Account workspace must resolve the saved selection from the user's loaded active memberships");
}
if (!liveData.includes("localStorage.removeItem('MNTYActiveMembershipId')")) {
  failures.push("Account workspace must clear a stale selected membership ID");
}
if (!liveData.includes(".eq('owner_user_id',uid).eq('business_id',active.business_id).eq('status','ACTIVE')")) {
  failures.push("Account workspace provider profile must be scoped to the selected active business");
}


// Execute the actual homepage account-label function against isolated membership/profile fixtures.
// This catches cross-business name leakage that static source markers alone cannot detect.
const executableHomeAuth = homeAuth + "\n    };";

async function renderHomepageActivityLabel({ selectedMembershipId, memberships, businesses, profiles }) {
  const loginButton = {
    innerHTML: "",
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; }
  };
  const user = {
    id: "user-1",
    email: "account@example.test",
    user_metadata: { full_name: "اسم الحساب" }
  };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user } }, error: null }) },
    from(table) {
      const filters = {};
      let ordering = null;
      let rowLimit = null;
      const builder = {
        select() { return builder; },
        eq(column, value) { filters[column] = value; return builder; },
        order(column, options) { ordering = { column, ascending: options?.ascending !== false }; return builder; },
        limit(value) { rowLimit = value; return builder; },
        async maybeSingle() {
          const source = table === "user_memberships" ? memberships
            : table === "businesses" ? businesses
            : table === "marketing_provider_profiles" ? profiles
            : [];
          let rows = source.filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
          if (ordering) rows.sort((a, b) => {
            const av = String(a[ordering.column] || "");
            const bv = String(b[ordering.column] || "");
            return ordering.ascending ? av.localeCompare(bv) : bv.localeCompare(av);
          });
          if (rowLimit !== null) rows = rows.slice(0, rowLimit);
          return { data: rows[0] || null, error: null };
        }
      };
      return builder;
    }
  };
  const context = {
    getClient: () => client,
    window: { MNTYActiveMembershipId: selectedMembershipId || "", MNTYAuthState: {} },
    localStorage: { getItem: key => key === "MNTYActiveMembershipId" ? selectedMembershipId || "" : null },
    document: { getElementById: id => id === "mx-login" ? loginButton : null },
    escapeHtml: value => String(value ?? ""),
    openActivityRequestModal() {}
  };
  await vm.runInNewContext(`(async () => { ${executableHomeAuth}\nawait syncHomeAuthState(); })()`, context, { timeout: 2000 });
  return loginButton.innerHTML;
}

const membershipFixtures = [
  { id: "membership-food", user_id: "user-1", business_id: "business-food", status: "ACTIVE" },
  { id: "membership-health", user_id: "user-1", business_id: "business-health", status: "ACTIVE" },
  { id: "membership-foreign", user_id: "someone-else", business_id: "business-foreign", status: "ACTIVE" }
];
const businessFixtures = [
  { id: "business-food", name: "مطعم الشرق" },
  { id: "business-health", name: "عيادة النور" },
  { id: "business-foreign", name: "نشاط مستخدم آخر" }
];
const profileFixtures = [
  { owner_user_id: "user-1", business_id: "business-food", status: "ACTIVE", name_ar: "مطعم الشرق", updated_at: "2026-11-20T00:00:00Z" },
  { owner_user_id: "user-1", business_id: "business-health", status: "ACTIVE", name_ar: "عيادة النور", updated_at: "2026-11-19T00:00:00Z" },
  { owner_user_id: "someone-else", business_id: "business-food", status: "ACTIVE", name_ar: "ملف لا يخص صاحب الحساب", updated_at: "2026-11-21T00:00:00Z" }
];
const identityScenarios = [
  { name: "selected FOOD membership", selectedMembershipId: "membership-food", memberships: membershipFixtures, businesses: businessFixtures, profiles: profileFixtures, expected: "مطعم الشرق", forbidden: "عيادة النور" },
  { name: "selected HEALTH membership", selectedMembershipId: "membership-health", memberships: membershipFixtures, businesses: businessFixtures, profiles: profileFixtures, expected: "عيادة النور", forbidden: "مطعم الشرق" },
  { name: "stale membership ID", selectedMembershipId: "membership-deleted", memberships: membershipFixtures, businesses: businessFixtures, profiles: profileFixtures, expected: "اسم الحساب", forbidden: "مطعم الشرق" },
  { name: "membership owned by another user", selectedMembershipId: "membership-foreign", memberships: membershipFixtures, businesses: businessFixtures, profiles: profileFixtures, expected: "اسم الحساب", forbidden: "نشاط مستخدم آخر" },
  { name: "selected business name fallback", selectedMembershipId: "membership-food", memberships: membershipFixtures, businesses: businessFixtures, profiles: profileFixtures.filter(p => p.business_id !== "business-food" || p.owner_user_id !== "user-1"), expected: "مطعم الشرق", forbidden: "ملف لا يخص صاحب الحساب" }
];
try {
  for (const scenario of identityScenarios) {
    const html = await renderHomepageActivityLabel(scenario);
    if (!html.includes(scenario.expected)) throw new Error(`${scenario.name}: expected "${scenario.expected}" in rendered account label`);
    if (html.includes(scenario.forbidden)) throw new Error(`${scenario.name}: unrelated activity "${scenario.forbidden}" leaked into rendered account label`);
    if (scenario.selectedMembershipId.startsWith("membership-") && !scenario.name.includes("stale") && !scenario.name.includes("another user")) {
      if (!html.includes("نشاط نشط")) throw new Error(`${scenario.name}: selected business should be labelled active`);
    }
    if (scenario.name.includes("stale") || scenario.name.includes("another user")) {
      if (!html.includes("مسجل الدخول")) throw new Error(`${scenario.name}: invalid selection must fall back to account-only status`);
    }
  }
  console.log("HOMEPAGE_SELECTED_BUSINESS_IDENTITY_FIXTURE=PASS scenarios=5 food_health_stale_foreign_owner_business_fallback=true");
} catch (error) {
  failures.push(`Homepage selected-business identity fixture: ${error.message}`);
}

if (failures.length) {
  console.error("Auth/registration production invariant check failed:");
  for (const name of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Auth/registration production invariants passed: ${required.length} checks + Owner role-switch invariants + selected-business identity checks.`);
