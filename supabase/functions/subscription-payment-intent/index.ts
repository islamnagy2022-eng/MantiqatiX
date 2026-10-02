import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")??""; const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""; const secretKey=Deno.env.get("PAYMOB_SECRET_KEY")??""; const publicKey=Deno.env.get("PAYMOB_PUBLIC_KEY")??""; const integrationId=Deno.env.get("PAYMOB_INTEGRATION_ID")??"";
const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(body:unknown,status=200,requestId?:string)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...(requestId?{"X-Request-Id":requestId}:{})}});
Deno.serve(async req=>{
 const requestId=req.headers.get("x-request-id")||crypto.randomUUID();
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405,requestId);
 const auth=req.headers.get("Authorization")??""; if(!auth.startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401,requestId);
 try{
  const {data:{user},error:userError}=await admin.auth.getUser(auth.slice(7)); if(userError||!user||user.is_anonymous)return json({error:"AUTH_REQUIRED"},401,requestId);
  if(!secretKey||!publicKey||!integrationId)return json({error:"PAYMENT_PROVIDER_NOT_CONFIGURED",requestId},503,requestId);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null; if(!body)return json({error:"INVALID_JSON"},400,requestId);
  const businessId=String(body.businessId??""); const tierCode=String(body.tierCode??"").trim().toUpperCase(); const billingCycle=String(body.billingCycle??"").trim().toUpperCase(); const sector=String(body.sector??"").trim(); const idempotencyKey=String(body.idempotencyKey??"").trim();
  if(!businessId||!tierCode||!["MONTHLY","ANNUAL"].includes(billingCycle)||!idempotencyKey)return json({error:"INVALID_REQUEST"},400,requestId);
  const {data:intent,error:intentError}=await admin.rpc("create_subscription_payment_intent_backend",{p_business_id:businessId,p_tier_code:tierCode,p_billing_cycle:billingCycle,p_sector:sector||null,p_idempotency_key:idempotencyKey,p_actor_user_id:user.id});
  if(intentError||!intent){console.error(JSON.stringify({requestId,stage:"create_subscription_payment_intent_backend",code:intentError?.code}));return json({error:"SUBSCRIPTION_PAYMENT_INTENT_REJECTED",requestId},400,requestId);}
  if(intent.status==="SUCCEEDED"|| (intent.provider_order_id&&intent.provider_intent_id))return json({paymentIntent:intent,requestId},200,requestId);
  const meta=(user.user_metadata??{}) as Record<string,unknown>; const email=String(user.email??meta.email??"customer@example.com"); const phone=String(meta.phone??meta.phone_number??"+201000000000"); const firstName=String(meta.first_name??meta.firstName??"MantiqaTix").slice(0,50); const lastName=String(meta.last_name??meta.lastName??"Customer").slice(0,50);
  const paymobResp=await fetch("https://accept.paymob.com/v1/intention/",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Token ${secretKey}`},body:JSON.stringify({amount:Math.round(Number(intent.amount)*100),currency:String(intent.currency),payment_methods:[Number(integrationId)],special_reference:`MANTIQATIX-SUB-${intent.id}`,items:[],billing_data:{first_name:firstName,last_name:lastName,email,phone_number:phone,country:"EGY",city:"Cairo",street:"NA",building:"NA",floor:"NA",apartment:"NA",postal_code:"NA",state:"Cairo"},extras:{mantiqatix_payment_intent_id:intent.id,business_id:businessId,tier_code:tierCode,billing_cycle:billingCycle}})});
  const paymob=await paymobResp.json().catch(()=>null) as Record<string,unknown>|null; if(!paymobResp.ok||!paymob){console.error(JSON.stringify({requestId,stage:"paymob_intention",status:paymobResp.status}));return json({error:"PAYMOB_INTENTION_FAILED",requestId},502,requestId);}
  const providerIntentId=String(paymob.id??""); const providerOrderId=String(paymob.intention_order_id??paymob.order_id??""); const clientSecret=String(paymob.client_secret??"");
  if(!providerIntentId||!providerOrderId||!clientSecret){console.error(JSON.stringify({requestId,stage:"paymob_intention_shape"}));return json({error:"PAYMOB_INTENTION_INVALID_RESPONSE",requestId},502,requestId);}
  const {data:updated,error:updateError}=await admin.from("subscription_payment_intents").update({status:"PENDING",provider_intent_id:providerIntentId,provider_order_id:providerOrderId,updated_at:new Date().toISOString()}).eq("id",intent.id).eq("status","CREATED").select().single();
  if(updateError||!updated)return json({error:"SUBSCRIPTION_PAYMENT_PERSISTENCE_FAILED",requestId},500,requestId);
  const checkoutUrl=`https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
  return json({paymentIntent:updated,clientSecret,checkoutUrl,requestId},200,requestId);
 }catch(e){console.error(JSON.stringify({requestId,stage:"unhandled",error:e instanceof Error?e.message:"UNKNOWN"}));return json({error:"SUBSCRIPTION_PAYMENT_FAILED",requestId},500,requestId);}
});