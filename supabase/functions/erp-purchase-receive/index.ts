import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({error:"METHOD_NOT_ALLOWED"}), {status:405,headers:{"content-type":"application/json"}});
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return new Response(JSON.stringify({error:"UNAUTHENTICATED"}), {status:401,headers:{"content-type":"application/json"}});
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anon, {global:{headers:{Authorization:auth}}});
    const {data:{user},error:userError} = await userClient.auth.getUser();
    if (userError || !user) throw new Error("UNAUTHENTICATED");
    const body = await req.json();
    const required = ["id","tenant_id","business_id","purchase_order_id","receipt_number","warehouse_id","product_id","received_quantity","unit_cost"];
    for (const k of required) if (body[k] === undefined || body[k] === null) throw new Error("INVALID_INPUT");
    if (Number(body.received_quantity) <= 0 || Number(body.unit_cost) < 0) throw new Error("INVALID_RECEIPT_AMOUNT");
    const {data:membership,error:me} = await db.from("user_memberships").select("role").eq("user_id",user.id).eq("tenant_id",body.tenant_id).eq("business_id",body.business_id).eq("status","ACTIVE").limit(1).maybeSingle();
    if (me || !membership || !["OWNER","BUSINESS_OWNER","ADMIN","MANAGER","EMPLOYEE","STAFF","ACCOUNTANT","FINANCE_MANAGER","FINANCE"].includes(String(membership.role).toUpperCase())) throw new Error("PURCHASE_RECEIVING_ROLE_REQUIRED");
    const {data:warehouse,error:we} = await db.from("warehouses").select("id,branch_id").eq("id",body.warehouse_id).eq("tenant_id",body.tenant_id).eq("business_id",body.business_id).eq("status","ACTIVE").maybeSingle();
    if (we || !warehouse) throw new Error("WAREHOUSE_INVALID");
    const {data:product,error:pe} = await db.from("catalog_items").select("id").eq("id",body.product_id).eq("tenant_id",body.tenant_id).eq("business_id",body.business_id).eq("status","ACTIVE").maybeSingle();
    if (pe || !product) throw new Error("PRODUCT_INVALID");
    const {data:received,error:receiveError}=await userClient.rpc("receive_purchase_stock_backend",{\n      p_id:String(body.id),\n      p_tenant_id:String(body.tenant_id),\n      p_business_id:String(body.business_id),\n      p_purchase_order_id:String(body.purchase_order_id),\n      p_receipt_number:String(body.receipt_number),\n      p_warehouse_id:String(body.warehouse_id),\n      p_product_id:String(body.product_id),\n      p_received_quantity:Number(body.received_quantity),\n      p_unit_cost:Number(body.unit_cost),\n    });\n    if(receiveError) throw new Error(receiveError.message);\n    return new Response(JSON.stringify(received),{headers:{"content-type":"application/json"}});\n  } catch (e) {
    const message=e instanceof Error?e.message:"INTERNAL_ERROR";
    const status=["UNAUTHENTICATED"].includes(message)?401:["PURCHASE_RECEIVING_ROLE_REQUIRED"].includes(message)?403:["INVALID_INPUT","INVALID_RECEIPT_AMOUNT","WAREHOUSE_INVALID","PRODUCT_INVALID"].includes(message)?400:500;
    return new Response(JSON.stringify({success:false,error:message}),{status,headers:{"content-type":"application/json"}});
  }
});