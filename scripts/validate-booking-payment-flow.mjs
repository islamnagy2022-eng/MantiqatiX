import fs from "node:fs";

const app=fs.readFileSync("web/app.js","utf8");
const home=fs.readFileSync("web/home.js","utf8");
const api=fs.readFileSync("supabase/functions/api/index.ts","utf8");
const order=fs.readFileSync("supabase/functions/order-create/index.ts","utf8");
const payment=fs.readFileSync("supabase/functions/payment-intent/index.ts","utf8");
const orderStatus=fs.readFileSync("supabase/functions/order-status-update/index.ts","utf8");
const orderStatusScope=fs.readFileSync("supabase/migrations/20261023030000_rc103_order_status_branch_scope.sql","utf8");
const orderIdempotencyScope=fs.readFileSync("supabase/migrations/20261023040000_rc104_order_idempotency_scope.sql","utf8");
const orderCreateServiceRoleScope=fs.readFileSync("supabase/migrations/20261023050000_rc105_order_create_service_role_identity.sql","utf8");
const orderStatusServiceRoleScope=fs.readFileSync("supabase/migrations/20261023060000_rc106_order_status_service_role_identity.sql","utf8");
const medicalBooking=fs.readFileSync("supabase/migrations/20261001003000_security_hardening_medical_status_authz.sql","utf8");
const medicalCreate=fs.readFileSync("supabase/migrations/20260928210000_rc172_restore_medical_booking_contract.sql","utf8");


const required=[
  ["Public provider booking requires auth", "MNTYPendingProvider", home],
  ["Public provider booking opens catalog", "openProviderCatalog", home],
  ["Order endpoint requires Bearer token", 'authHeader?.startsWith("Bearer ")', api],
  ["Order endpoint rejects anonymous users", "user.is_anonymous", api],
  ["Order-create bounds request bytes before JSON parsing", "MAX_BODY_BYTES = 256 * 1024", order],
  ["Oversized order-create payloads are rejected", "REQUEST_TOO_LARGE", order],
  ["Order-create rejects non-object JSON payloads", "INVALID_BODY", order],
  ["Order-create bounds customer name, phone, address, and notes", "INVALID_CUSTOMER_NAME", order],
  ["Order-create rejects unsupported client metadata keys", "UNSUPPORTED_ORDER_METADATA", order],
  ["Order creation uses backend RPC", 'rpc("create_order_backend"', api],
  ["Order creation validates catalog items", "CATALOG_ITEM_NOT_AVAILABLE", order],
  ["Order creation validates active pricing", "ACTIVE_PRICE_NOT_AVAILABLE", order],
  ["Order creation rejects duplicate or oversized selected options", "INVALID_ITEM_OPTIONS", order],
  ["Order pricing rejects non-finite final totals", "if (!Number.isFinite(totalAmount))", order],
  ["Server requires branch when active branches exist", "BRANCH_REQUIRED", order],
  ["Server validates selected branch", "BRANCH_NOT_AVAILABLE", order],
  ["Staff order creation is authorized for the exact selected branch", 'targetMembershipQuery.eq("branch_id", branchId)', order],
  ["Order creation resolves branch scope before membership authorization", 'const branchId = body.branchId ? String(body.branchId) : null;', order],
  ["Catalog API exposes active branches", "branches: branches ?? []", api],
  ["Customer catalog requires branch selection", "mx-catalog-branch", app],
  ["Customer order requires branch", "if(!branchId)", app],
  ["Customer order sends selected branch", "branchId,clientIdempotencyKey", app],
  ["Order creation uses server-authoritative pricing", "pricing_server_authoritative: true", order],
  ["Order creation records catalog pricing authority", 'pricing_authority: "catalog_v1"', order],
  ["Verified Edge Function service-role path is supported for order creation", "coalesce(auth.role(),'') <> 'service_role'", orderCreateServiceRoleScope],
  ["Non-service-role order creation remains bound to auth.uid", "auth.uid() is distinct from p_customer_id", orderCreateServiceRoleScope],
  ["Order-create service-role migration preserves the existing RPC ACL", "CREATE OR REPLACE preserves the existing function identity and its ACL", orderCreateServiceRoleScope],
  ["Order idempotency key rejects reuse by another customer or seller scope", "IDEMPOTENCY_KEY_CONFLICT", orderIdempotencyScope],
  ["Idempotent replay is filtered by authenticated customer", "and customer_id=p_customer_id", orderIdempotencyScope],
  ["Idempotent replay is filtered by business", "and business_id=p_business_id", orderIdempotencyScope],
  ["Idempotent replay is filtered by exact branch", "and branch_id is not distinct from p_branch_id", orderIdempotencyScope],
  ["Order idempotency conflict is checked before returning a stored snapshot", "o.customer_id is distinct from p_customer_id", orderIdempotencyScope],
  ["RC104 preserves existing RPC ACLs without grant changes", "CREATE OR REPLACE preserves the existing function identity and its ACL", orderIdempotencyScope],
  ["Payment requires authenticated user", "user.is_anonymous", payment],
  ["Payment requires pricing snapshot", "pricing_hash", payment],
  ["Payment revalidates pricing before provider call", "Authoritative pricing changed; restart payment", payment],
  ["Payment provider is Paymob", 'p_provider: "PAYMOB"', payment],
  ["Paymob secret remains server-side", "PAYMOB_SECRET_KEY", payment]
];

const forbiddenClientOrder=[
  [/.from\(['"]orders['"]\)\.insert\(/, "Direct client order INSERT"],
  [/\.from\(['"]orders['"]\)\.update\(/, "Direct client order UPDATE"],
  [/\.from\(['"]payment_intents['"]\)\.insert\(/, "Direct client payment_intent INSERT"]
];


const additionalRequired=[
  ["Order status endpoint requires bearer authentication", 'h.startsWith("Bearer ")', orderStatus],
  ["Order status endpoint rejects anonymous sessions", "data.user.is_anonymous", orderStatus],
  ["Order status RPC accepts verified service-role Edge Function identity", "coalesce(auth.role(), '') <> 'service_role'", orderStatusServiceRoleScope],
  ["Non-service-role order status mutation remains bound to auth.uid", "p_user_id is distinct from auth.uid()", orderStatusServiceRoleScope],
  ["Order status service-role migration preserves existing RPC ACL", "CREATE OR REPLACE preserves the existing function identity and ACL", orderStatusServiceRoleScope],
  ["Order status mutation delegates to authoritative backend RPC", 'admin.rpc("update_order_status_backend"', orderStatus],
  ["Order status branch-scope migration preserves authenticated identity binding", "p_user_id is distinct from auth.uid()", orderStatusScope],
  ["Operational status updates require exact business and branch membership", "m.branch_id is not distinct from v_order.branch_id", orderStatusScope],
  ["Tenant-wide owner/admin roles remain explicitly allowlisted", "upper(m.role) in ('OWNER', 'ADMIN')", orderStatusScope],
  ["Owner/admin tenant-wide access requires an entirely unscoped membership", "(upper(m.role) in ('OWNER', 'ADMIN') and m.business_id is null and m.branch_id is null)", orderStatusScope],
  ["Business-scoped owner/admin cannot bypass exact business/branch scope", "m.branch_id is not distinct from v_order.branch_id", orderStatusScope],
  ["Customer-owned cancellation path is preserved", "v_order.customer_id = p_user_id and upper(p_new_status) = 'CANCELLED'", orderStatusScope],
  ["Paid-order cancellation remains blocked without refund handling", "ORDER_PAID_REQUIRES_REFUND_BEFORE_CANCELLATION", orderStatusScope],
  ["Medical booking binds caller to auth.uid", "p_user_id<>auth.uid()", medicalCreate],
  ["Medical booking requires active provider", "ACTIVE_MEDICAL_PROVIDER_NOT_FOUND", medicalCreate],
  ["Medical booking requires active tenant membership", "ACTIVE_TENANT_MEMBERSHIP_REQUIRED", medicalCreate],
  ["Medical booking checks duplicate appointment identifier", "APPOINTMENT_ID_ALREADY_EXISTS", medicalCreate],
  ["Medical status mutation binds actor to auth.uid", "p_user_id <> v_uid", medicalBooking],
  ["Medical status changes require active appointment membership", "ACTIVE_MEMBERSHIP_REQUIRED", medicalBooking],
  ["Medical status changes are role-gated", "PROVIDER_STATUS_CHANGE_REQUIRED", medicalBooking],
  ["Medical status target is allowlisted", "INVALID_MEDICAL_STATUS", medicalBooking]
];

const failures=[];
for(const [name,marker,source] of required) if(!source.includes(marker)) failures.push(name);
for(const [name,marker,source] of additionalRequired) if(!source.includes(marker)) failures.push(name);
const branchScopeIndex=order.indexOf('if (branchId) targetMembershipQuery = targetMembershipQuery.eq("branch_id", branchId);');
const customerFallbackIndex=order.indexOf("if (!targetMembership)");
if(branchScopeIndex<0||customerFallbackIndex<0||branchScopeIndex>customerFallbackIndex) failures.push("Staff branch scope must be checked before customer fallback authorization");
if(order.split("const branchId = body.branchId").length-1!==1) failures.push("Order creation must define branch scope exactly once before membership authorization");
if(orderStatusScope.toLowerCase().includes("grant execute")||orderStatusScope.toLowerCase().includes("revoke execute")) failures.push("RC103 must not broaden or alter backend-only order-status RPC execution grants");
if(orderIdempotencyScope.toLowerCase().includes("grant execute")||orderIdempotencyScope.toLowerCase().includes("revoke execute")) failures.push("RC104 must not broaden or alter backend-only order-create RPC execution grants");
if(orderCreateServiceRoleScope.toLowerCase().includes("grant execute")||orderCreateServiceRoleScope.toLowerCase().includes("revoke execute")) failures.push("RC105 must not broaden or alter backend-only order-create RPC execution grants");
if(orderStatusServiceRoleScope.toLowerCase().includes("grant execute")||orderStatusServiceRoleScope.toLowerCase().includes("revoke execute")) failures.push("RC106 must not broaden or alter backend-only order-status RPC execution grants");
for(const [re,label] of forbiddenClientOrder) if(re.test(app)) failures.push(label);

if(failures.length){
  console.error("Booking/payment production invariant check failed:");
  failures.forEach(x=>console.error("-",x));
  process.exit(1);
}
console.log(`Booking/payment production invariants passed: ${required.length} required checks + ${forbiddenClientOrder.length} forbidden direct-write checks.`);
