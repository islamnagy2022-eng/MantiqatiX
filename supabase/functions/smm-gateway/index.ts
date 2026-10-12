
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://islamnagy2022-eng.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const URL=Deno.env.get("SUPABASE_URL")!,KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,admin=createClient(URL,KEY);
async function getUser(req:Request){const a=req.headers.get("Authorization")||"";const t=a.replace(/^Bearer\s+/i,"");if(!t)return null;const r=await admin.auth.getUser(t);const user=r.error?null:r.data.user;return !user||user.is_anonymous?null:user;}
async function isAdmin(id:string){const a=await admin.from("smm_admins").select("user_id").eq("user_id",id).maybeSingle();if(a.error)return false;if(a.data)return true;const r=await admin.from("user_memberships").select("tenant_id,role,status,business_id,permissions").eq("user_id",id).eq("status","ACTIVE");if(r.error)return false;return (r.data||[]).some((m:any)=>{const role=String(m.role||"").toUpperCase(),p=m.permissions&&typeof m.permissions==="object"?m.permissions:{};return role==="SUPER_ADMIN"&&String(m.tenant_id)==="MNTY-PLATFORM"&&m.business_id==null&&p.scope==="PLATFORM"&&p.full_control===true;});}
async function secret(id:string){const r=await admin.rpc("smm_get_provider_secret",{p_provider_id:id});if(r.error||!r.data)throw new Error("Provider credential unavailable");return r.data as string;}
import { assertSafeProviderEndpoint, readProviderJson } from "./provider-transport.ts";
import { normalizeProviderOrderStatus } from "./order-status.ts";

async function call(p:any,k:string,a:string,x:any={}) {
 const endpoint=assertSafeProviderEndpoint(p?.api_url,Deno.env.get("SMM_PROVIDER_HOSTS"));
 const f=new URLSearchParams();f.set("key",k);f.set("action",a);Object.entries(x).forEach(([n,v])=>f.set(n,String(v)));
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const r=await fetch(endpoint.toString(),{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:f.toString(),signal:controller.signal,redirect:"error"});
  // Keep the timeout active through response-body consumption, not just until headers arrive.
  return await readProviderJson(r);
 }catch{throw new Error("Provider request failed, timed out, or returned invalid data");}
 finally{clearTimeout(timer);}
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 // The separate SMM storefront is deferred until after core launch. Default-deny all actions unless an explicitly approved rollout sets this flag to exactly "true".
 if(Deno.env.get("MNTY_SMM_ENABLED")!=="true")return json({error:"SMM_DEFERRED",message:"خدمات التسويق الرقمي المستقلة مؤجلة حاليًا؛ استخدم قسم التسويق والإعلان داخل المنصة."},503);
 const user=await getUser(req);if(!user)return json({error:"UNAUTHORIZED"},401);
 try{
  const b=await req.json(),a=b.action;
  if(a==="catalog"){
   const [s,p]=await Promise.all([
    admin.from("smm_services").select("id,provider_id,platform,category,name,description,selling_price,min_quantity,max_quantity,refill,cancel,dripfeed").eq("active",true).order("platform").order("category").limit(500),
    admin.from("smm_providers").select("id").eq("active",true).limit(500)
   ]);
   if(s.error||p.error){console.error("[smm-gateway] catalog read failed",s.error?.code||p.error?.code||"DB_ERROR");return json({error:"CATALOG_READ_FAILED"},500);}
   const activeProviders=new Set((p.data||[]).map((x:any)=>String(x.id)));
   const services=(s.data||[]).filter((x:any)=>activeProviders.has(String(x.provider_id))).map((x:any)=>({
    id:x.id,platform:x.platform,category:x.category,name:x.name,description:x.description,
    selling_price:x.selling_price,min_quantity:x.min_quantity,max_quantity:x.max_quantity,
    refill:x.refill,cancel:x.cancel,dripfeed:x.dripfeed
   }));
   return json({services});
  }
  if(a==="my_data"){
   const [o,w]=await Promise.all([
    admin.from("smm_orders").select("id,service_id,quantity,selling_price,status,provider_order_id,created_at,updated_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50),
    admin.from("smm_wallets").select("balance").eq("user_id",user.id).maybeSingle()
   ]);
   if(o.error||w.error){console.error("[smm-gateway] account read failed",o.error?.code||w.error?.code||"DB_ERROR");return json({error:"ACCOUNT_DATA_READ_FAILED"},500);}
   return json({orders:o.data||[],balance:Number(w.data?.balance||0),is_admin:await isAdmin(user.id)});
  }
  if(a==="configure_provider"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const r=await admin.rpc("smm_set_provider_secret",{p_provider_id:b.provider_id,p_actor_user_id:user.id,p_secret:b.api_key});if(r.error)return json({error:r.error.message},400);return json({ok:true});}
  if(a==="sync_services"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const p=await admin.from("smm_providers").select("*").eq("id",b.provider_id).single();if(!p.data)return json({error:"PROVIDER_NOT_FOUND"},404);const r=await call(p.data,await secret(b.provider_id),"services");if(!Array.isArray(r))return json({error:"INVALID_PROVIDER_RESPONSE"},502);let n=0;for(const s of r){const row={provider_id:b.provider_id,external_service_id:String(s.service||s.id||""),platform:String(s.platform||s.category||"Other"),category:String(s.category||"Other"),name:String(s.name||"Service"),description:String(s.description||""),provider_cost:Number(s.rate||0),selling_price:Number(s.rate||0),min_quantity:Number(s.min||1),max_quantity:Number(s.max||1000000),refill:!!s.refill,cancel:!!s.cancel,dripfeed:!!s.dripfeed,active:true,metadata:s};if(!row.external_service_id)continue;const u=await admin.from("smm_services").upsert(row,{onConflict:"provider_id,external_service_id"});if(!u.error)n++;}return json({ok:true,count:n});}
  if(a==="provider_status"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const p=await admin.from("smm_providers").select("*").eq("id",b.provider_id).single();if(!p.data)return json({error:"PROVIDER_NOT_FOUND"},404);return json({ok:true,provider:p.data.name,result:await call(p.data,await secret(b.provider_id),"balance")});}
  if(a==="admin_credit"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const ok=await admin.rpc("smm_admin_credit_wallet",{p_actor:user.id,p_user:b.user_id,p_amount:Number(b.amount),p_description:b.description||"Manual admin credit"});if(ok.error)return json({error:ok.error.message},400);return json({ok:true});}
  if(a==="admin_data"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const [p,s,o]=await Promise.all([admin.from("smm_providers").select("id,name,api_url,active,priority").order("priority"),admin.from("smm_services").select("id,provider_id,platform,category,name,provider_cost,selling_price,min_quantity,max_quantity,active").order("created_at",{ascending:false}).limit(200),admin.from("smm_orders").select("id,user_id,service_id,quantity,selling_price,profit,status,provider_order_id,created_at").order("created_at",{ascending:false}).limit(100)]);return json({providers:p.data||[],services:s.data||[],orders:o.data||[]});}
  if(a==="set_price"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const price=Number(b.selling_price);if(!Number.isFinite(price)||price<0)return json({error:"INVALID_PRICE"},400);const r=await admin.from("smm_services").update({selling_price:price,updated_at:new Date().toISOString()}).eq("id",b.service_id);if(r.error)return json({error:r.error.message},400);return json({ok:true});}
  if(a==="place_order"){
   const q=Number(b.quantity);
   if(!b.service_id||!b.target_url||!Number.isInteger(q)||q<=0)return json({error:"INVALID_ORDER"},400);
   const s=await admin.from("smm_services").select("*,smm_providers(*)").eq("id",b.service_id).eq("active",true).single();
   if(s.error||!s.data)return json({error:"SERVICE_NOT_FOUND"},404);
   const v=s.data;
   if(q<v.min_quantity||q>v.max_quantity)return json({error:"QUANTITY_OUT_OF_RANGE",min:v.min_quantity,max:v.max_quantity},400);
   const sell=Number(v.selling_price)*q/1000,cost=Number(v.provider_cost)*q/1000;
   if(!Number.isFinite(sell)||!Number.isFinite(cost)||sell<0||cost<0)return json({error:"INVALID_SERVICE_PRICING"},409);
   const o=await admin.from("smm_orders").insert({user_id:user.id,service_id:b.service_id,target_url:b.target_url,quantity:q,selling_price:sell,provider_cost:cost,profit:sell-cost,status:"SUBMITTING"}).select("id").single();
   if(o.error||!o.data){console.error("[smm-gateway] order insert failed",o.error?.code||"DB_ERROR");return json({error:"ORDER_CREATE_FAILED"},500);}
   const orderId=o.data.id;
   const debit=await admin.rpc("smm_debit_wallet",{p_user:user.id,p_amount:sell,p_reference:orderId});
   if(debit.error){
    console.error("[smm-gateway] wallet debit result unknown",debit.error.code||"RPC_ERROR");
    const mark=await admin.from("smm_orders").update({error_message:"Wallet debit outcome unknown; manual reconciliation required",updated_at:new Date().toISOString()}).eq("id",orderId);
    if(mark.error)console.error("[smm-gateway] could not annotate unknown debit",mark.error.code||"DB_ERROR");
    return json({error:"WALLET_DEBIT_RESULT_UNKNOWN",order_id:orderId,reconciliation_required:true},202);
   }
   if(debit.data!==true){
    const mark=await admin.from("smm_orders").update({status:"FAILED",error_message:"Wallet debit rejected",updated_at:new Date().toISOString()}).eq("id",orderId);
    if(mark.error)console.error("[smm-gateway] could not mark rejected debit",mark.error.code||"DB_ERROR");
    return json({error:"INSUFFICIENT_BALANCE",required:sell,order_id:orderId},402);
   }
   let providerResult:any;
   try{
    providerResult=await call(v.smm_providers,await secret(v.provider_id),"add",{service:v.external_service_id,link:b.target_url,quantity:q});
   }catch{
    console.error("[smm-gateway] provider outcome unknown",String(orderId));
    const mark=await admin.from("smm_orders").update({error_message:"Provider outcome unknown; do not retry or refund automatically; manual reconciliation required",updated_at:new Date().toISOString()}).eq("id",orderId);
    if(mark.error)console.error("[smm-gateway] could not annotate provider outcome",mark.error.code||"DB_ERROR");
    return json({error:"PROVIDER_RESULT_UNKNOWN",order_id:orderId,reconciliation_required:true},202);
   }
   const pid=providerResult?.order??providerResult?.order_id;
   if(pid===undefined||pid===null||String(pid).trim()===""){
    console.error("[smm-gateway] provider accepted response without order id",String(orderId));
    const mark=await admin.from("smm_orders").update({error_message:"Provider response lacked order ID; outcome requires manual reconciliation",updated_at:new Date().toISOString()}).eq("id",orderId);
    if(mark.error)console.error("[smm-gateway] could not annotate missing provider ID",mark.error.code||"DB_ERROR");
    return json({error:"PROVIDER_RESULT_UNKNOWN",order_id:orderId,reconciliation_required:true},202);
   }
   const persisted=await admin.from("smm_orders").update({status:"PROCESSING",provider_order_id:String(pid),provider_status:"submitted",updated_at:new Date().toISOString()}).eq("id",orderId);
   if(persisted.error){
    console.error("[smm-gateway] provider accepted but order persistence failed",persisted.error.code||"DB_ERROR",String(orderId));
    return json({error:"PROVIDER_ACCEPTED_PERSISTENCE_PENDING",order_id:orderId,reconciliation_required:true},202);
   }
   const event=await admin.from("smm_order_events").insert({order_id:orderId,event_type:"SUBMITTED",payload:{provider_order_id:String(pid),provider_status:"submitted"}});
   if(event.error)console.error("[smm-gateway] order event insert failed",event.error.code||"DB_ERROR",String(orderId));
   return json({ok:true,order_id:orderId,provider_order_id:String(pid),status:"PROCESSING",charged:sell,event_recorded:!event.error});
  }if(a==="order_status"){
   const o=await admin.from("smm_orders").select("id,status,provider_order_id,service_id,smm_services(provider_id,smm_providers(*))").eq("id",b.order_id).eq("user_id",user.id).single();
   if(o.error||!o.data)return json({error:"ORDER_NOT_FOUND"},404);
   if(!o.data.provider_order_id)return json({ok:true,status:o.data.status});
   const orderData:any=o.data;
   const serviceData=Array.isArray(orderData.smm_services)?orderData.smm_services[0]:orderData.smm_services;
   const providerData=Array.isArray(serviceData?.smm_providers)?serviceData.smm_providers[0]:serviceData?.smm_providers;
   if(!serviceData||!providerData)return json({error:"PROVIDER_CONFIGURATION_UNAVAILABLE"},503);
   const r:any=await call(providerData,await secret(serviceData.provider_id),"status",{order:o.data.provider_order_id});
   const rawStatus=typeof r?.status==="string"?r.status.replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,64):"";
   const terminal=new Set(["COMPLETED","CANCELLED","FAILED","PARTIAL"]);
   const nextStatus=normalizeProviderOrderStatus(o.data.status,rawStatus);
   if(nextStatus!==o.data.status||rawStatus){
    const saved=await admin.from("smm_orders").update({status:nextStatus,provider_status:rawStatus||null,updated_at:new Date().toISOString()}).eq("id",b.order_id).eq("user_id",user.id);
    if(saved.error){console.error("[smm-gateway] order status persistence failed",saved.error.code||"DB_ERROR");return json({error:"ORDER_STATUS_PERSISTENCE_PENDING",order_id:b.order_id,reconciliation_required:true},202);}
    const event=await admin.from("smm_order_events").insert({order_id:b.order_id,event_type:"STATUS_SYNC",payload:{provider_status:rawStatus||null,normalized_status:nextStatus,terminal_status_preserved:terminal.has(String(o.data.status||"").toUpperCase())}});
    if(event.error)console.error("[smm-gateway] status event insert failed",event.error.code||"DB_ERROR");
   }
   return json({ok:true,status:nextStatus,provider_status:rawStatus||null});
  }
  return json({error:"UNKNOWN_ACTION"},400);
 }catch(e){return json({error:e instanceof Error?e.message:"INTERNAL_ERROR"},500);}
});