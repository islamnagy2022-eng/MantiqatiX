import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({error:"METHOD_NOT_ALLOWED"}), {status:405,headers:{"content-type":"application/json"}});
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return new Response(JSON.stringify({error:"UNAUTHENTICATED"}), {status:401,headers:{"content-type":"application/json"}});
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, {global:{headers:{Authorization:auth}}});
    const {data:{user},error:userError} = await userClient.auth.getUser();
    if (userError || !user) throw new Error("UNAUTHENTICATED");
    const body = await req.json();
    const required = ["id","tenant_id","business_id","purchase_order_id","receipt_number","warehouse_id","product_id","received_quantity","unit_cost"];
    for (const k of required) if (body[k] === undefined || body[k] === null) throw new Error("INVALID_INPUT");
    if (Number(body.received_quantity) <= 0 || Number(body.unit_cost) < 0) throw new Error("INVALID_RECEIPT_AMOUNT");
    const db = createClient(url, service);
    const {data:membership,error:me} = await db.from("user_memberships").select("role").eq("user_id",user.id).eq("tenant_id",body.tenant_id).eq("business_id",body.business_id).eq("status","ACTIVE").limit(1).maybeSingle();
    if (me || !membership || !["OWNER","BUSINESS_OWNER","ADMIN","MANAGER","EMPLOYEE","STAFF","ACCOUNTANT","FINANCE_MANAGER","FINANCE"].includes(String(membership.role).toUpperCase())) throw new Error("PURCHASE_RECEIVING_ROLE_REQUIRED");
    const {data:warehouse,error:we} = await db.from("warehouses").select("id,branch_id").eq("id",body.warehouse_id).eq("tenant_id",body.tenant_id).eq("business_id",body.business_id).eq("status","ACTIVE").maybeSingle();
    if (we || !warehouse) throw new Error("WAREHOUSE_INVALID");
    const {data:product,error:pe} = await db.from("catalog_items").select("id").eq("id",body.product_id).eq("tenant_id",body.tenant_id).eq("business_id",body.business_id).eq("status","ACTIVE").maybeSingle();
    if (pe || !product) throw new Error("PRODUCT_INVALID");
    const {data:existing} = await db.from("erp_purchase_receipts").select("*").eq("business_id",body.business_id).eq("receipt_number",body.receipt_number).maybeSingle();
    if (existing) return new Response(JSON.stringify({success:true,idempotent:true,receipt:existing}),{headers:{"content-type":"application/json"}});
    const {data:balance} = await db.from("stock_balances").select("*").eq("tenant_id",body.tenant_id).eq("business_id",body.business_id).eq("warehouse_id",body.warehouse_id).eq("product_id",body.product_id).maybeSingle();
    let finalBalance;
    if (!balance) {
      const row={id:"sb-"+crypto.randomUUID(),tenant_id:body.tenant_id,business_id:body.business_id,branch_id:warehouse.branch_id,warehouse_id:body.warehouse_id,product_id:body.product_id,quantity_on_hand:Number(body.received_quantity),quantity_reserved:0};
      const {data,error}=await db.from("stock_balances").insert(row).select("*").single(); if(error) throw error; finalBalance=data;
    } else {
      const next=Number(balance.quantity_on_hand)+Number(body.received_quantity);
      const {data,error}=await db.from("stock_balances").update({quantity_on_hand:next,updated_at:new Date().toISOString()}).eq("id",balance.id).select("*").single(); if(error) throw error; finalBalance=data;
    }
    const receipt={id:body.id,tenant_id:body.tenant_id,business_id:body.business_id,purchase_order_id:body.purchase_order_id,receipt_number:body.receipt_number,warehouse_id:body.warehouse_id,product_id:body.product_id,received_quantity:Number(body.received_quantity),unit_cost:Number(body.unit_cost),status:"RECEIVED",created_by:user.id};
    const {data:created,error:ce}=await db.from("erp_purchase_receipts").insert(receipt).select("*").single(); if(ce) throw ce;
    const tx={id:"it-"+crypto.randomUUID(),tenant_id:body.tenant_id,business_id:body.business_id,branch_id:warehouse.branch_id,warehouse_id:body.warehouse_id,product_id:body.product_id,transaction_type:"PURCHASE_RECEIPT",quantity:Number(body.received_quantity),unit_cost:Number(body.unit_cost),reference_id:created.id,created_by:user.id};
    const {data:transaction,error:te}=await db.from("inventory_transactions").insert(tx).select("*").single(); if(te) throw te;
    return new Response(JSON.stringify({success:true,idempotent:false,receipt:created,balance:finalBalance,transaction}),{headers:{"content-type":"application/json"}});
  } catch (e) {
    const message=e instanceof Error?e.message:"INTERNAL_ERROR";
    const status=["UNAUTHENTICATED"].includes(message)?401:["PURCHASE_RECEIVING_ROLE_REQUIRED"].includes(message)?403:["INVALID_INPUT","INVALID_RECEIPT_AMOUNT","WAREHOUSE_INVALID","PRODUCT_INVALID"].includes(message)?400:500;
    return new Response(JSON.stringify({success:false,error:message}),{status,headers:{"content-type":"application/json"}});
  }
});