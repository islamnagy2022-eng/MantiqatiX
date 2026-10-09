import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: cors });
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(projectUrl, serviceKey, { global: { headers: { Authorization: auth } } });
    const admin = createClient(projectUrl, serviceKey);
    const { data: { user }, error: userError } = await client.auth.getUser(auth.slice(7));
    if (userError || !user || user.is_anonymous) return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: cors });
    const body = await req.json(), action = String(body.action ?? "").toUpperCase(), tenantId = String(body.tenantId ?? ""), businessId = String(body.businessId ?? "");
    if (!tenantId || !businessId) return new Response(JSON.stringify({ error: "TENANT_BUSINESS_REQUIRED" }), { status: 400, headers: cors });
    if (!["ITEM_UPSERT","PRICE_UPSERT","SETTINGS_UPSERT"].includes(action)) return new Response(JSON.stringify({ error: "UNSUPPORTED_ACTION" }), { status: 400, headers: cors });

    // Enforce tenant + business + branch authorization at the Edge boundary before
    // calling SECURITY DEFINER catalog RPCs. Tenant membership alone is insufficient.
    const { data: memberships, error: membershipError } = await admin.from("user_memberships")
      .select("tenant_id,business_id,branch_id,role,permissions,status")
      .eq("user_id", user.id).eq("tenant_id", tenantId).eq("status", "ACTIVE");
    if (membershipError) throw new Error("MEMBERSHIP_CHECK_FAILED");
    const branchId = body.branchId == null || body.branchId === "" ? null : String(body.branchId);
    const allowed = (memberships ?? []).some((m: any) => {
      const role = String(m.role ?? "").toUpperCase();
      const permissions = m.permissions ?? {};
      if (role === "SUPER_ADMIN") return permissions.scope === "PLATFORM" && permissions.full_control === true;
      if (!["OWNER","ADMIN","MANAGER","BUSINESS_OWNER"].includes(role)) return false;
      const businessMatches = String(m.business_id ?? "") === businessId || (role === "OWNER" && !m.business_id);
      if (!businessMatches) return false;
      if (role === "MANAGER") return Boolean(branchId && m.branch_id && String(m.branch_id) === branchId);
      return !branchId || !m.branch_id || String(m.branch_id) === branchId;
    });
    if (!allowed) return new Response(JSON.stringify({ error: "CATALOG_SCOPE_FORBIDDEN" }), { status: 403, headers: cors });
    if (branchId) {
      const { data: branch, error: branchError } = await admin.from("branches").select("id")
        .eq("id", branchId).eq("tenant_id", tenantId).eq("business_id", businessId).eq("status", "ACTIVE").maybeSingle();
      if (branchError || !branch) return new Response(JSON.stringify({ error: "BRANCH_NOT_AVAILABLE" }), { status: 403, headers: cors });
    }
    if (action === "ITEM_UPSERT") {
      const { data, error } = await client.rpc("upsert_catalog_item_backend", {p_tenant_id:tenantId,p_business_id:businessId,p_branch_id:body.branchId??null,p_legacy_ref:body.legacyRef??null,p_item_type:body.itemType??"PRODUCT",p_name_ar:body.nameAr,p_name_en:body.nameEn??null,p_description:body.description??null,p_sku:body.sku??null,p_tax_rate:Number(body.taxRate??0),p_metadata:body.metadata??{},p_id:body.id??null});
      if(error)throw error; return new Response(JSON.stringify(data),{status:200,headers:cors});
    }
    if (action === "PRICE_UPSERT") {
      const { data, error } = await client.rpc("upsert_catalog_price_backend", {p_tenant_id:tenantId,p_business_id:businessId,p_catalog_item_id:body.catalogItemId,p_branch_id:body.branchId??null,p_currency:body.currency??"EGP",p_unit_price:Number(body.unitPrice),p_effective_from:body.effectiveFrom??new Date().toISOString(),p_effective_to:body.effectiveTo??null});
      if(error)throw error; return new Response(JSON.stringify(data),{status:200,headers:cors});
    }
    if (action === "SETTINGS_UPSERT") {
      const { data, error } = await client.rpc("upsert_catalog_settings_backend",{p_tenant_id:tenantId,p_business_id:businessId,p_currency:String(body.currency??"EGP").toUpperCase(),p_delivery_fee:Number(body.deliveryFee??0),p_tax_inclusive:Boolean(body.taxInclusive??false),p_allow_discounts:Boolean(body.allowDiscounts??false)});
      if(error)throw error; return new Response(JSON.stringify(data),{status:200,headers:cors});
    }
    return new Response(JSON.stringify({error:"UNSUPPORTED_ACTION"}),{status:400,headers:cors});
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"CATALOG_OPERATION_FAILED"}),{status:400,headers:cors});}
});