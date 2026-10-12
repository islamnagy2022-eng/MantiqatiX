
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://islamnagy2022-eng.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const URL=Deno.env.get("SUPABASE_URL")!,KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,admin=createClient(URL,KEY);
async function getUser(req:Request){const a=req.headers.get("Authorization")||"";const t=a.replace(/^Bearer\s+/i,"");if(!t)return null;const r=await admin.auth.getUser(t);const user=r.error?null:r.data.user;return !user||user.is_anonymous?null:user;}
async function isAdmin(id:string){const a=await admin.from("smm_admins").select("user_id").eq("user_id",id).maybeSingle();if(a.error)return false;if(a.data)return true;const r=await admin.from("user_memberships").select("tenant_id,role,status,business_id,permissions").eq("user_id",id).eq("status","ACTIVE");if(r.error)return false;return (r.data||[]).some((m:any)=>{const role=String(m.role||"").toUpperCase(),p=m.permissions&&typeof m.permissions==="object"?m.permissions:{};return role==="SUPER_ADMIN"&&String(m.tenant_id)==="MNTY-PLATFORM"&&m.business_id==null&&p.scope==="PLATFORM"&&p.full_control===true;});}
async function secret(id:string){const r=await admin.rpc("smm_get_provider_secret",{p_provider_id:id});if(r.error||!r.data)throw new Error("Provider credential unavailable");return r.data as string;}
class ProviderCallError extends Error{constructor(message:string,public definitiveRejection=false){super(message);this.name="ProviderCallError";}}
const isUuid=(v:any)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function call(p:any,k:string,a:string,x:any={}){
 const f=new URLSearchParams();f.set("key",k);f.set("action",a);Object.entries(x).forEach(([n,v])=>f.set(n,String(v)));
 let r:Response;
 try{r=await fetch(p.api_url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:f.toString(),signal:AbortSignal.timeout(15000)});}
 catch{throw new ProviderCallError("Provider network outcome unknown",false);}
 const t=await r.text();let d:any;try{d=JSON.parse(t)}catch{throw new ProviderCallError("Provider response outcome unknown",false);}
 if(!r.ok)throw new ProviderCallError("Provider response outcome unknown",false);
 if(a==="add"&&(d?.error||d?.errors)&&!(d?.order??d?.order_id)){
  throw new ProviderCallError("Provider explicitly rejected order",true);
 }
 return d;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 // SMM is deferred from initial launch. Fail closed before auth, DB, wallet, or provider actions.
 if(Deno.env.get("MNTY_SMM_ENABLED")!=="true")return json({error:"SMM_POST_LAUNCH_DEFERRED"},503);
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
  if(a==="admin_access")return json({is_admin:await isAdmin(user.id)});\n  if(a==="configure_provider"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const r=await admin.rpc("smm_set_provider_secret",{p_provider_id:b.provider_id,p_actor_user_id:user.id,p_secret:b.api_key});if(r.error)return json({error:r.error.message},400);return json({ok:true});}
  if(a==="sync_services"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const p=await admin.from("smm_providers").select("*").eq("id",b.provider_id).single();if(!p.data)return json({error:"PROVIDER_NOT_FOUND"},404);const r=await call(p.data,await secret(b.provider_id),"services");if(!Array.isArray(r))return json({error:"INVALID_PROVIDER_RESPONSE",result:r},502);let n=0;for(const s of r){const row={provider_id:b.provider_id,external_service_id:String(s.service||s.id||""),platform:String(s.platform||s.category||"Other"),category:String(s.category||"Other"),name:String(s.name||"Service"),description:String(s.description||""),provider_cost:Number(s.rate||0),selling_price:Number(s.rate||0),min_quantity:Number(s.min||1),max_quantity:Number(s.max||1000000),refill:!!s.refill,cancel:!!s.cancel,dripfeed:!!s.dripfeed,active:true,metadata:s};if(!row.external_service_id)continue;const u=await admin.from("smm_services").upsert(row,{onConflict:"provider_id,external_service_id"});if(!u.error)n++;}return json({ok:true,count:n});}
  if(a==="provider_status"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const p=await admin.from("smm_providers").select("*").eq("id",b.provider_id).single();if(!p.data)return json({error:"PROVIDER_NOT_FOUND"},404);return json({ok:true,provider:p.data.name,result:await call(p.data,await secret(b.provider_id),"balance")});}
  if(a==="admin_credit"){
   if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);
   const amount=Number(b.amount);
   if(!Number.isFinite(amount)||amount<=0)return json({error:"INVALID_AMOUNT"},400);
   if(!isUuid(b.user_id)||!isUuid(b.reference_id))return json({error:"INVALID_REFERENCE"},400);
   const ok=await admin.rpc("smm_admin_credit_wallet",{p_actor:user.id,p_user:b.user_id,p_amount:amount,p_description:b.description||"Manual admin credit",p_reference:b.reference_id});
   if(ok.error||ok.data!==true)return json({error:"WALLET_CREDIT_OUTCOME_UNKNOWN",reconciliation_required:true,reference_id:b.reference_id},503);
   return json({ok:true,reference_id:b.reference_id});
  }
  if(a==="admin_data"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const [p,s,o]=await Promise.all([admin.from("smm_providers").select("id,name,api_url,active,priority").order("priority"),admin.from("smm_services").select("id,provider_id,platform,category,name,provider_cost,selling_price,min_quantity,max_quantity,active").order("created_at",{ascending:false}).limit(200),admin.from("smm_orders").select("id,user_id,service_id,quantity,selling_price,profit,status,provider_order_id,created_at").order("created_at",{ascending:false}).limit(100)]);return json({providers:p.data||[],services:s.data||[],orders:o.data||[]});}
  if(a==="set_price"){if(!(await isAdmin(user.id)))return json({error:"FORBIDDEN"},403);const price=Number(b.selling_price);if(!Number.isFinite(price)||price<0)return json({error:"INVALID_PRICE"},400);const r=await admin.from("smm_services").update({selling_price:price,updated_at:new Date().toISOString()}).eq("id",b.service_id);if(r.error)return json({error:r.error.message},400);return json({ok:true});}
  if(a==="place_order"){
   const q=Number(b.quantity);
   if(!b.service_id||!b.target_url||typeof b.target_url!=="string"||b.target_url.length>2048||!Number.isInteger(q)||q<=0)return json({error:"INVALID_ORDER"},400);
   const s=await admin.from("smm_services").select("*,smm_providers(*)").eq("id",b.service_id).eq("active",true).single();
   if(!s.data)return json({error:"SERVICE_NOT_FOUND"},404);
   const v=s.data;
   if(!v.smm_providers?.active)return json({error:"PROVIDER_INACTIVE"},409);
   if(q<v.min_quantity||q>v.max_quantity)return json({error:"QUANTITY_OUT_OF_RANGE",min:v.min_quantity,max:v.max_quantity},400);
   const sell=Number(v.selling_price)*q/1000,cost=Number(v.provider_cost)*q/1000;
   if(!Number.isFinite(sell)||sell<=0||!Number.isFinite(cost)||cost<0)return json({error:"INVALID_SERVICE_PRICE"},409);
   const o=await admin.from("smm_orders").insert({user_id:user.id,service_id:b.service_id,target_url:b.target_url,quantity:q,selling_price:sell,provider_cost:cost,profit:sell-cost,status:"SUBMITTING"}).select("id").single();
   if(o.error||!o.data)return json({error:"ORDER_CREATE_FAILED"},500);
   const r=await admin.rpc("smm_debit_wallet",{p_user:user.id,p_amount:sell,p_reference:o.data.id});const debit=r;
   if(debit.error){
    await admin.from("smm_orders").update({status:"WALLET_DEBIT_OUTCOME_UNKNOWN",error_message:"Wallet debit outcome requires reconciliation",updated_at:new Date().toISOString()}).eq("id",o.data.id).eq("status","SUBMITTING");
    await admin.from("smm_order_events").insert({order_id:o.data.id,event_type:"WALLET_DEBIT_OUTCOME_UNKNOWN",payload:{reconciliation_required:true}});
    return json({error:"WALLET_DEBIT_OUTCOME_UNKNOWN",order_id:o.data.id,reconciliation_required:true},503);
   }
   if(debit.data!==true){
    if(debit.data!==false){
     await admin.from("smm_orders").update({status:"WALLET_DEBIT_OUTCOME_UNKNOWN",error_message:"Wallet debit returned a non-boolean result; reconciliation required",updated_at:new Date().toISOString()}).eq("id",o.data.id).eq("status","SUBMITTING");
     await admin.from("smm_order_events").insert({order_id:o.data.id,event_type:"WALLET_DEBIT_OUTCOME_UNKNOWN",payload:{reconciliation_required:true}});
     return json({error:"WALLET_DEBIT_OUTCOME_UNKNOWN",order_id:o.data.id,reconciliation_required:true},503);
    }
    await admin.from("smm_orders").update({status:"FAILED",error_message:"Insufficient wallet balance",updated_at:new Date().toISOString()}).eq("id",o.data.id).eq("status","SUBMITTING");
    return json({error:"INSUFFICIENT_BALANCE",required:sell,order_id:o.data.id},402);
   }
   try{
    const r=await call(v.smm_providers,await secret(v.provider_id),"add",{service:v.external_service_id,link:b.target_url,quantity:q});
    const pid=r.order??r.order_id;
    if(!pid)throw new ProviderCallError("PROVIDER_ORDER_ID_MISSING",false);
    const persisted=await admin.from("smm_orders").update({status:"PROCESSING",provider_order_id:String(pid),provider_status:"submitted",updated_at:new Date().toISOString()}).eq("id",o.data.id).eq("status","SUBMITTING").select("id").maybeSingle();
    if(persisted.error||!persisted.data){
     await admin.from("smm_orders").update({status:"PROVIDER_ACCEPTED_PERSISTENCE_UNKNOWN",provider_order_id:String(pid),error_message:"Provider accepted; persistence requires reconciliation",updated_at:new Date().toISOString()}).eq("id",o.data.id).in("status",["SUBMITTING","PROCESSING"]);
     await admin.from("smm_order_events").insert({order_id:o.data.id,event_type:"PROVIDER_ACCEPTED_PERSISTENCE_UNKNOWN",payload:{provider_order_id:String(pid),reconciliation_required:true}});
     return json({error:"PROVIDER_ACCEPTED_PERSISTENCE_UNKNOWN",order_id:o.data.id,reconciliation_required:true},503);
    }
    const event=await admin.from("smm_order_events").insert({order_id:o.data.id,event_type:"SUBMITTED",payload:{provider_order_id:String(pid)}});
    if(event.error)console.error("[smm-gateway] accepted order event insert failed",event.error.code||"DB_ERROR");
    return json({ok:true,order_id:o.data.id,provider_order_id:String(pid),status:"PROCESSING",charged:sell});
   }catch(e){
    const m=e instanceof Error?e.message:"Provider outcome unknown";
    const definitive=e instanceof ProviderCallError&&e.definitiveRejection;
    if(!definitive){
     await admin.from("smm_orders").update({status:"PROVIDER_OUTCOME_UNKNOWN",error_message:m,updated_at:new Date().toISOString()}).eq("id",o.data.id).eq("status","SUBMITTING");
     await admin.from("smm_order_events").insert({order_id:o.data.id,event_type:"PROVIDER_OUTCOME_UNKNOWN",payload:{message:m,reconciliation_required:true}});
     return json({error:m==="PROVIDER_ORDER_ID_MISSING"?"PROVIDER_ORDER_ID_MISSING":"PROVIDER_OUTCOME_UNKNOWN",order_id:o.data.id,reconciliation_required:true},502);
    }
    const refund=await admin.rpc("smm_refund_wallet",{p_user:user.id,p_amount:sell,p_reference:o.data.id,p_description:"Refund after explicit provider rejection"});
    if(refund.error||refund.data!==true){
     await admin.from("smm_orders").update({status:"REFUND_OUTCOME_UNKNOWN",error_message:"Explicit provider rejection; refund requires reconciliation",updated_at:new Date().toISOString()}).eq("id",o.data.id).eq("status","SUBMITTING");
     await admin.from("smm_order_events").insert({order_id:o.data.id,event_type:"REFUND_OUTCOME_UNKNOWN",payload:{reconciliation_required:true}});
     return json({error:"REFUND_OUTCOME_UNKNOWN",order_id:o.data.id,reconciliation_required:true},503);
    }
    await admin.from("smm_orders").update({status:"FAILED",error_message:m,updated_at:new Date().toISOString()}).eq("id",o.data.id).eq("status","SUBMITTING");
    return json({error:"PROVIDER_EXECUTION_FAILED",order_id:o.data.id,refunded:true},502);
   }
  }
  if(a==="order_status"){
   const o=await admin.from("smm_orders").select("*,smm_services(*,smm_providers(*))").eq("id",b.order_id).eq("user_id",user.id).single();
   if(!o.data)return json({error:"ORDER_NOT_FOUND"},404);
   const terminal=new Set(["COMPLETED","CANCELLED","FAILED","REFUNDED"]);
   if(terminal.has(String(o.data.status)))return json({ok:true,status:o.data.status,terminal:true});
   if(!o.data.provider_order_id)return json({ok:true,status:o.data.status,reconciliation_required:String(o.data.status).includes("UNKNOWN")});
   const r=await call(o.data.smm_services.smm_providers,await secret(o.data.smm_services.provider_id),"status",{order:o.data.provider_order_id}),m=String(r.status||"").toLowerCase();
   let st=o.data.status;
   if(["completed","complete"].includes(m))st="COMPLETED";
   else if(m==="partial")st="PARTIAL";
   else if(["canceled","cancelled"].includes(m))st="CANCELLED";
   else if(["processing","in progress","inprogress"].includes(m))st="PROCESSING";
   if(!terminal.has(st)){
    await admin.from("smm_orders").update({status:st,provider_status:r.status??null,updated_at:new Date().toISOString()}).eq("id",b.order_id).eq("user_id",user.id).not("status","in", "(COMPLETED,CANCELLED,FAILED,REFUNDED)");
   }
   await admin.from("smm_order_events").insert({order_id:b.order_id,event_type:"STATUS_SYNC",payload:{status:r.status??null}});
   return json({ok:true,status:st});
  }
  return json({error:"UNKNOWN_ACTION"},400);
 }catch(e){return json({error:e instanceof Error?e.message:"INTERNAL_ERROR"},500);}
});