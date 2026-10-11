
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://islamnagy2022-eng.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const URL=Deno.env.get("SUPABASE_URL")!,KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,admin=createClient(URL,KEY);
async function getUser(req:Request){const a=req.headers.get("Authorization")||"";const t=a.replace(/^Bearer\s+/i,"");if(!t)return null;const r=await admin.auth.getUser(t);return r.error?null:r.data.user;}
async function isAdmin(id:string){const a=await admin.from("smm_admins").select("user_id").eq("user_id",id).maybeSingle();if(a.error)throw new Error("SMM_ADMIN_CHECK_FAILED");return !!a.data;}
async function secret(id:string){const r=await admin.rpc("smm_get_provider_secret",{p_provider_id:id});if(r.error||!r.data)throw new Error("Provider credential unavailable");return r.data as string;}
class ProviderCallError extends Error { constructor(message:string, public definitiveRejection=false){super(message);this.name="ProviderCallError";} }
async function call(p:any,k:string,a:string,x:any={}){
 const f=new URLSearchParams();f.set("key",k);f.set("action",a);Object.entries(x).forEach(([n,v])=>f.set(n,String(v)));
 let r:Response;
 try{r=await fetch(p.api_url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:f.toString(),signal:AbortSignal.timeout(15000)});}
 catch{throw new ProviderCallError("Provider network outcome unknown",false);}
 const t=await r.text();let d:any;try{d=JSON.parse(t)}catch{d=null}
 const explicitRejection=!!(d&&typeof d==="object"&&(d.success===false||d.error||d.errors));
 if(!r.ok){throw new ProviderCallError(explicitRejection&&r.status<500?"Provider explicitly rejected request":"Provider response outcome unknown",explicitRejection&&r.status<500);}
 if(explicitRejection)throw new ProviderCallError("Provider explicitly rejected request",true);
 if(!d||typeof d!=="object")throw new ProviderCallError("Provider returned an unparseable response",false);
 return d;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const user=await getUser(req);if(!user)return json({error:"UNAUTHORIZED"},401);
 try{
  const b=await req.json(),a=b.action;
  if(a==="admin_access"){const r=await admin.from("smm_admins").select("user_id").eq("user_id",user.id).maybeSingle();if(r.error)return json({error:"ADMIN_CHECK_FAILED"},500);return json({is_admin:!!r.data});}
  if(a==="configure_provider"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const r=await admin.rpc("smm_set_provider_secret",{p_provider_id:b.provider_id,p_actor_user_id:user.id,p_secret:b.api_key});if(r.error||r.data!==true)return json({error:r.error?.message||"PROVIDER_CREDENTIAL_NOT_SAVED"},400);return json({ok:true});}
  if(a==="sync_services"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const p=await admin.from("smm_providers").select("*").eq("id",b.provider_id).single();if(!p.data)return json({error:"PROVIDER_NOT_FOUND"},404);const r=await call(p.data,await secret(b.provider_id),"services");if(!Array.isArray(r))return json({error:"INVALID_PROVIDER_RESPONSE",result:r},502);let n=0;for(const s of r){const row={provider_id:b.provider_id,external_service_id:String(s.service||s.id||""),platform:String(s.platform||s.category||"Other"),category:String(s.category||"Other"),name:String(s.name||"Service"),description:String(s.description||""),provider_cost:Number(s.rate||0),selling_price:Number(s.rate||0),min_quantity:Number(s.min||1),max_quantity:Number(s.max||1000000),refill:!!s.refill,cancel:!!s.cancel,dripfeed:!!s.dripfeed,active:true,metadata:s};if(!row.external_service_id)continue;const u=await admin.from("smm_services").upsert(row,{onConflict:"provider_id,external_service_id"});if(!u.error)n++;}return json({ok:true,count:n});}
  if(a==="provider_status"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const p=await admin.from("smm_providers").select("*").eq("id",b.provider_id).single();if(!p.data)return json({error:"PROVIDER_NOT_FOUND"},404);return json({ok:true,provider:p.data.name,result:await call(p.data,await secret(b.provider_id),"balance")});}
  if(a==="admin_credit"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const amount=Number(b.amount);if(!b.user_id||!b.reference_id||!Number.isFinite(amount)||amount<=0)return json({error:"INVALID_CREDIT_REQUEST"},400);const ok=await admin.rpc("smm_admin_credit_wallet",{p_actor:user.id,p_user:b.user_id,p_amount:amount,p_description:b.description||"Manual admin credit",p_reference:b.reference_id});if(ok.error||ok.data!==true)return json({error:ok.error?.message||"WALLET_CREDIT_NOT_APPLIED"},400);return json({ok:true,reference_id:b.reference_id});}
  if(a==="admin_data"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const [p,s,o]=await Promise.all([admin.from("smm_providers").select("id,name,api_url,active,priority").order("priority"),admin.from("smm_services").select("id,provider_id,platform,category,name,provider_cost,selling_price,min_quantity,max_quantity,active").order("created_at",{ascending:false}).limit(200),admin.from("smm_orders").select("id,user_id,service_id,quantity,selling_price,profit,status,provider_order_id,created_at").order("created_at",{ascending:false}).limit(100)]);return json({providers:p.data||[],services:s.data||[],orders:o.data||[]});}
  if(a==="set_price"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const price=Number(b.selling_price);if(!Number.isFinite(price)||price<0)return json({error:"INVALID_PRICE"},400);const r=await admin.from("smm_services").update({selling_price:price,updated_at:new Date().toISOString()}).eq("id",b.service_id);if(r.error)return json({error:r.error.message},400);return json({ok:true});}
  if(a==="place_order"){
   const q=Number(b.quantity),target=typeof b.target_url==="string"?b.target_url.trim():"";
   if(!b.service_id||!target||target.length>2048||!Number.isInteger(q)||q<=0)return json({error:"INVALID_ORDER"},400);
   let targetUrl:URL;try{targetUrl=new URL(target)}catch{return json({error:"INVALID_TARGET_URL"},400)}
   if(!["https:","http:"].includes(targetUrl.protocol)||targetUrl.username||targetUrl.password)return json({error:"INVALID_TARGET_URL"},400);
   const s=await admin.from("smm_services").select("*,smm_providers(*)").eq("id",b.service_id).eq("active",true).single();
   if(s.error||!s.data)return json({error:"SERVICE_NOT_FOUND"},404);
   const v=s.data;
   if(!Number.isInteger(Number(v.min_quantity))||!Number.isInteger(Number(v.max_quantity))||q<Number(v.min_quantity)||q>Number(v.max_quantity))return json({error:"QUANTITY_OUT_OF_RANGE",min:v.min_quantity,max:v.max_quantity},400);
   const unitSell=Number(v.selling_price),unitCost=Number(v.provider_cost);
   if(!Number.isFinite(unitSell)||unitSell<0||!Number.isFinite(unitCost)||unitCost<0)return json({error:"SERVICE_PRICE_INVALID"},409);
   const sell=unitSell*q/1000,cost=unitCost*q/1000;
   if(!Number.isFinite(sell)||!Number.isFinite(cost)||sell<0||cost<0)return json({error:"ORDER_AMOUNT_INVALID"},400);
   const o=await admin.from("smm_orders").insert({user_id:user.id,service_id:b.service_id,target_url:target,quantity:q,selling_price:sell,provider_cost:cost,profit:sell-cost,status:"SUBMITTING"}).select("id").single();
   if(o.error||!o.data)return json({error:"ORDER_CREATE_FAILED"},500);
   const orderId=o.data.id;
   const debit=await admin.rpc("smm_debit_wallet",{p_user:user.id,p_amount:sell,p_reference:orderId});
   if(debit.error){
    await admin.from("smm_order_events").insert({order_id:orderId,event_type:"WALLET_DEBIT_OUTCOME_UNKNOWN",payload:{code:"WALLET_DEBIT_OUTCOME_UNKNOWN"}});
    return json({error:"WALLET_DEBIT_OUTCOME_UNKNOWN",order_id:orderId,reconciliation_required:true},503);
   }
   if(debit.data!==true){
    await admin.from("smm_orders").update({status:"FAILED",error_message:"Wallet debit rejected",updated_at:new Date().toISOString()}).eq("id",orderId);
    await admin.from("smm_order_events").insert({order_id:orderId,event_type:"WALLET_DEBIT_REJECTED",payload:{code:"INSUFFICIENT_BALANCE"}});
    return json({error:"INSUFFICIENT_BALANCE",required:sell,order_id:orderId},402);
   }
   let providerKey:string;
   try{providerKey=await secret(v.provider_id);}
   catch{
    const refund=await admin.rpc("smm_refund_wallet",{p_user:user.id,p_amount:sell,p_reference:orderId,p_description:"Automatic refund before provider request"});
    if(refund.error||refund.data!==true){await admin.from("smm_order_events").insert({order_id:orderId,event_type:"REFUND_OUTCOME_UNKNOWN",payload:{code:"REFUND_OUTCOME_UNKNOWN"}});return json({error:"REFUND_RECONCILIATION_REQUIRED",order_id:orderId,reconciliation_required:true},503);}
    const upd=await admin.from("smm_orders").update({status:"FAILED",error_message:"Provider credential unavailable before request",updated_at:new Date().toISOString()}).eq("id",orderId).select("id").maybeSingle();
    await admin.from("smm_order_events").insert({order_id:orderId,event_type:"PROVIDER_NOT_CONTACTED",payload:{code:"PROVIDER_CREDENTIAL_UNAVAILABLE"}});
    if(upd.error||!upd.data)return json({error:"ORDER_FINALIZATION_UNKNOWN",order_id:orderId,reconciliation_required:true},503);
    return json({error:"PROVIDER_UNAVAILABLE",order_id:orderId},502);
   }
   let providerResult:any;
   try{providerResult=await call(v.smm_providers,providerKey,"add",{service:v.external_service_id,link:target,quantity:q});}
   catch(e){
    const definitive=e instanceof ProviderCallError&&e.definitiveRejection;
    if(!definitive){
     await admin.from("smm_orders").update({error_message:"Provider outcome unknown; reconciliation required",updated_at:new Date().toISOString()}).eq("id",orderId);
     await admin.from("smm_order_events").insert({order_id:orderId,event_type:"PROVIDER_OUTCOME_UNKNOWN",payload:{code:"PROVIDER_OUTCOME_UNKNOWN"}});
     return json({error:"PROVIDER_OUTCOME_UNKNOWN",order_id:orderId,reconciliation_required:true},503);
    }
    const refund=await admin.rpc("smm_refund_wallet",{p_user:user.id,p_amount:sell,p_reference:orderId,p_description:"Refund after explicit provider rejection"});
    if(refund.error||refund.data!==true){
     await admin.from("smm_order_events").insert({order_id:orderId,event_type:"REFUND_OUTCOME_UNKNOWN",payload:{code:"REFUND_OUTCOME_UNKNOWN"}});
     return json({error:"REFUND_RECONCILIATION_REQUIRED",order_id:orderId,reconciliation_required:true},503);
    }
    const upd=await admin.from("smm_orders").update({status:"FAILED",error_message:"Provider explicitly rejected request",updated_at:new Date().toISOString()}).eq("id",orderId).select("id").maybeSingle();
    await admin.from("smm_order_events").insert({order_id:orderId,event_type:"PROVIDER_REJECTED",payload:{code:"PROVIDER_REJECTED"}});
    if(upd.error||!upd.data)return json({error:"ORDER_FINALIZATION_UNKNOWN",order_id:orderId,reconciliation_required:true},503);
    return json({error:"PROVIDER_EXECUTION_FAILED",order_id:orderId},502);
   }
   const pid=providerResult.order??providerResult.order_id;
   if(pid===undefined||pid===null||String(pid).trim()===""){
    await admin.from("smm_orders").update({error_message:"Provider response lacks order correlation; reconciliation required",updated_at:new Date().toISOString()}).eq("id",orderId);
    await admin.from("smm_order_events").insert({order_id:orderId,event_type:"PROVIDER_OUTCOME_UNKNOWN",payload:{code:"PROVIDER_ORDER_ID_MISSING"}});
    return json({error:"PROVIDER_OUTCOME_UNKNOWN",order_id:orderId,reconciliation_required:true},503);
   }
   const providerOrderId=String(pid);
   const persisted=await admin.from("smm_orders").update({status:"PROCESSING",provider_order_id:providerOrderId,provider_status:"submitted",updated_at:new Date().toISOString()}).eq("id",orderId).eq("status","SUBMITTING").select("id").maybeSingle();
   if(persisted.error||!persisted.data){
    await admin.from("smm_order_events").insert({order_id:orderId,event_type:"PROVIDER_ACCEPTED_PERSISTENCE_UNKNOWN",payload:{code:"PROVIDER_ACCEPTED_PERSISTENCE_UNKNOWN",provider_order_id:providerOrderId}});
    return json({error:"PROVIDER_ACCEPTED_PERSISTENCE_UNKNOWN",order_id:orderId,provider_order_id:providerOrderId,reconciliation_required:true},503);
   }
   const event=await admin.from("smm_order_events").insert({order_id:orderId,event_type:"SUBMITTED",payload:{provider_order_id:providerOrderId}});
   return json({ok:true,order_id:orderId,provider_order_id:providerOrderId,status:"PROCESSING",charged:sell,audit_event_pending:!!event.error});
  }
  if(a==="order_status"){const o=await admin.from("smm_orders").select("*,smm_services(*,smm_providers(*))").eq("id",b.order_id).eq("user_id",user.id).single();if(!o.data)return json({error:"ORDER_NOT_FOUND"},404);if(!o.data.provider_order_id)return json({ok:true,status:o.data.status});const r=await call(o.data.smm_services.smm_providers,await secret(o.data.smm_services.provider_id),"status",{order:o.data.provider_order_id}),m=String(r.status||"").toLowerCase();let st=String(o.data.status||"").toUpperCase();const terminal=new Set(["COMPLETED","CANCELLED","FAILED","REFUNDED"]);if(!terminal.has(st)){if(["completed","complete"].includes(m))st="COMPLETED";else if(m==="partial")st="PARTIAL";else if(["canceled","cancelled"].includes(m))st="CANCELLED";else if(["processing","in progress","inprogress"].includes(m))st="PROCESSING";}const saved=await admin.from("smm_orders").update({status:st,provider_status:r.status??null,updated_at:new Date().toISOString()}).eq("id",b.order_id).eq("user_id",user.id).select("id").maybeSingle();if(saved.error||!saved.data)return json({error:"ORDER_STATUS_PERSISTENCE_UNKNOWN",order_id:b.order_id,reconciliation_required:true},503);const event=await admin.from("smm_order_events").insert({order_id:b.order_id,event_type:"STATUS_SYNC",payload:{provider_status:r.status??null,normalized_status:st}});return json({ok:true,status:st,order_id:b.order_id,audit_event_pending:!!event.error});}
  return json({error:"UNKNOWN_ACTION"},400);
 }catch(e){return json({error:e instanceof Error?e.message:"INTERNAL_ERROR"},500);}
});