import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: cors });
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: userError } = await client.auth.getUser(auth.slice(7));
    if (userError || !user || user.is_anonymous) return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: cors });
    const body = await req.json(), action = String(body.action ?? "").toUpperCase(), tenantId = String(body.tenantId ?? ""), businessId = String(body.businessId ?? "");
    if (!tenantId || !businessId) return new Response(JSON.stringify({ error: "TENANT_BUSINESS_REQUIRED" }), { status: 400, headers: cors });
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