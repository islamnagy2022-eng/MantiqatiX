import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isValidPaymobAmountCents, matchesPaymobIntention } from "../_shared/paymob-intent-correlation.mjs";
const url=Deno.env.get("SUPABASE_URL")??""; const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""; const secretKey=Deno.env.get("PAYMOB_SECRET_KEY")??""; const publicKey=Deno.env.get("PAYMOB_PUBLIC_KEY")??""; const integrationId=Deno.env.get("PAYMOB_INTEGRATION_ID")??"";
const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(body:unknown,status=200,requestId?:string)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...(requestId?{"X-Request-Id":requestId}:{})}});
const checkoutKeyVersion="V1";
const checkoutKeySecret=Deno.env.get("PAYMOB_CHECKOUT_ENCRYPTION_KEY_V1")??"";
const decodeBase64=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
const encodeBase64=(v:ArrayBuffer|Uint8Array)=>{const bytes=v instanceof Uint8Array?v:new Uint8Array(v);let binary="";for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);};
async function checkoutCryptoKey(){if(!checkoutKeySecret)throw new Error("CHECKOUT_ENCRYPTION_KEY_MISSING");const raw=decodeBase64(checkoutKeySecret);if(raw.length!==32)throw new Error("CHECKOUT_ENCRYPTION_KEY_INVALID");return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);}
async function encryptCheckoutSecretPayload(secret:string){const key=await checkoutCryptoKey();const iv=crypto.getRandomValues(new Uint8Array(12));const additionalData=new TextEncoder().encode("MantiqaTix:PaymobCheckout:"+checkoutKeyVersion);const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData},key,new TextEncoder().encode(secret));return {ciphertext:encodeBase64(ciphertext),iv:encodeBase64(iv),keyVersion:checkoutKeyVersion};}
async function decryptCheckoutSecretPayload(ciphertext:string,ivText:string,keyVersion:string){if(keyVersion!==checkoutKeyVersion)throw new Error("CHECKOUT_ENCRYPTION_KEY_VERSION_UNAVAILABLE");const key=await checkoutCryptoKey();const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv:decodeBase64(ivText),additionalData:new TextEncoder().encode("MantiqaTix:PaymobCheckout:"+keyVersion)},key,decodeBase64(ciphertext));return new TextDecoder().decode(plaintext);}
Deno.serve(async req=>{
 const requestId=req.headers.get("x-request-id")||crypto.randomUUID();
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405,requestId);
 const auth=req.headers.get("Authorization")??""; if(!auth.startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401,requestId);
 try{
  const {data:{user},error:userError}=await admin.auth.getUser(auth.slice(7)); if(userError||!user||user.is_anonymous)return json({error:"AUTH_REQUIRED"},401,requestId);
  if(!secretKey||!publicKey||!integrationId)return json({error:"PAYMENT_PROVIDER_NOT_CONFIGURED",requestId},503,requestId);
  if(!checkoutKeySecret)return json({error:"CHECKOUT_SECRET_ENCRYPTION_NOT_CONFIGURED",requestId},503,requestId);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null; if(!body)return json({error:"INVALID_JSON"},400,requestId);
  const businessId=String(body.businessId??""); const tierCode=String(body.tierCode??"").trim().toUpperCase(); const billingCycle=String(body.billingCycle??"").trim().toUpperCase(); const sector=String(body.sector??"").trim(); const idempotencyKey=String(body.idempotencyKey??"").trim();
  if(!businessId||!tierCode||!["MONTHLY","ANNUAL"].includes(billingCycle)||!idempotencyKey)return json({error:"INVALID_REQUEST"},400,requestId);
  const email=String(user.email??"").trim(); const meta=(user.user_metadata??{}) as Record<string,unknown>; const phone=String(user.phone??meta.phone??meta.phone_number??"").trim(); const firstName=String(meta.first_name??meta.firstName??user.email?.split("@")[0]??"Customer").slice(0,50); const lastName=String(meta.last_name??meta.lastName??"Customer").slice(0,50); if(!email||!phone)return json({error:"CUSTOMER_BILLING_CONTACT_REQUIRED"},422,requestId);
  const {data:intent,error:intentError}=await admin.rpc("create_subscription_payment_intent_claimable_backend",{p_business_id:businessId,p_tier_code:tierCode,p_billing_cycle:billingCycle,p_sector:sector||null,p_idempotency_key:idempotencyKey,p_actor_user_id:user.id});
  if(intentError||!intent){console.error(JSON.stringify({requestId,stage:"create_subscription_payment_intent_claimable_backend",code:intentError?.code}));return json({error:"SUBSCRIPTION_PAYMENT_INTENT_REJECTED",requestId},400,requestId);}
  if(String(intent.status??"").toUpperCase()==="SUCCEEDED")return json({paymentIntent:intent,requestId},200,requestId);
  const {data:claimData,error:claimError}=await admin.rpc("claim_subscription_provider_intent_creation_backend",{p_intent_id:intent.id,p_actor_user_id:user.id});
  if(claimError||!claimData)return json({error:"SUBSCRIPTION_PROVIDER_CLAIM_FAILED",requestId},500,requestId);
  const claim=claimData as Record<string,unknown>;
  const claimedIntent=(claim.intent&&typeof claim.intent==="object"?claim.intent:intent) as Record<string,unknown>;
  if(claim.outcome_unknown===true||claimedIntent.provider_creation_state==="RECONCILIATION_REQUIRED")return json({error:"PAYMENT_PROVIDER_OUTCOME_UNKNOWN",requestId},409,requestId);
  if(claim.claimed!==true){
    if(claimedIntent.provider_intent_id&&claimedIntent.provider_order_id&&claimedIntent.client_secret_ciphertext&&claimedIntent.client_secret_iv&&claimedIntent.client_secret_key_version){
      try{
        const clientSecret=await decryptCheckoutSecretPayload(String(claimedIntent.client_secret_ciphertext),String(claimedIntent.client_secret_iv),String(claimedIntent.client_secret_key_version));
        const checkoutUrl=`https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
        return json({paymentIntent:claimedIntent,clientSecret,checkoutUrl,requestId},200,requestId);
      }catch{return json({error:"CHECKOUT_RECOVERY_UNAVAILABLE",requestId},503,requestId);}
    }
    return json({error:"SUBSCRIPTION_PAYMENT_INTENT_NOT_CLAIMED",requestId},409,requestId);
  }
  const amountCents=Math.round(Number(claimedIntent.amount)*100);
  if(!isValidPaymobAmountCents(Number(claimedIntent.amount),amountCents)){await admin.from("subscription_payment_intents").update({provider_creation_state:"RECONCILIATION_REQUIRED",updated_at:new Date().toISOString()}).eq("id",claimedIntent.id).eq("provider_creation_state","CLAIMED");return json({error:"SUBSCRIPTION_AMOUNT_PRECISION_INVALID",requestId},409,requestId);}
  let paymob:Record<string,unknown>={};let providerResponseStatus=0;
  try{
    const paymobResp=await fetch("https://accept.paymob.com/v1/intention/",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Token ${secretKey}`},body:JSON.stringify({amount:amountCents,currency:String(claimedIntent.currency).toUpperCase(),payment_methods:[Number(integrationId)],special_reference:String(claimedIntent.id),items:[],billing_data:{first_name:firstName,last_name:lastName,email,phone_number:phone,country:"EGY",city:"NA",street:"NA",building:"NA",floor:"NA",apartment:"NA",postal_code:"NA",state:"NA"},extras:{mantiqatix_payment_intent_id:claimedIntent.id,business_id:businessId,tier_code:tierCode,billing_cycle:billingCycle}})});
    providerResponseStatus=paymobResp.status;paymob=await paymobResp.json().catch(()=>({})) as Record<string,unknown>;
  }catch{
    await admin.from("subscription_payment_intents").update({provider_creation_state:"RECONCILIATION_REQUIRED",updated_at:new Date().toISOString()}).eq("id",claimedIntent.id).eq("provider_creation_state","CLAIMED");
    return json({error:"PAYMENT_PROVIDER_OUTCOME_UNKNOWN",requestId},502,requestId);
  }
  const providerIntentId=String(paymob.id??"");const providerOrderId=String(paymob.intention_order_id??paymob.order_id??"");const clientSecret=String(paymob.client_secret??"");
  if(providerResponseStatus>=400&&[400,401,403,404,422].includes(providerResponseStatus)&&!providerIntentId&&!providerOrderId&&!clientSecret){
    const {error:resetError}=await admin.from("subscription_payment_intents").update({status:"CREATED",provider_creation_state:"READY",provider_creation_claimed_at:null,updated_at:new Date().toISOString()}).eq("id",claimedIntent.id).eq("provider_creation_state","CLAIMED");
    if(resetError)return json({error:"PAYMENT_REJECTION_REQUIRES_RECONCILIATION",requestId},500,requestId);
    return json({error:"PAYMOB_INTENTION_FAILED",requestId},502,requestId);
  }
  if(providerResponseStatus<200||providerResponseStatus>=300||!providerIntentId||!providerOrderId||!clientSecret){
    await admin.from("subscription_payment_intents").update({provider_creation_state:"RECONCILIATION_REQUIRED",updated_at:new Date().toISOString()}).eq("id",claimedIntent.id).eq("provider_creation_state","CLAIMED");
    return json({error:"PAYMENT_PROVIDER_OUTCOME_UNKNOWN",requestId},502,requestId);
  }
  if (!matchesPaymobIntention({provider:paymob,amountCents,currency:String(claimedIntent.currency).toUpperCase(),reference:String(claimedIntent.id)})){
    await admin.from("subscription_payment_intents").update({provider_creation_state:"RECONCILIATION_REQUIRED",updated_at:new Date().toISOString()}).eq("id",claimedIntent.id).eq("provider_creation_state","CLAIMED");
    return json({error:"PAYMENT_PROVIDER_INTENT_MISMATCH",requestId},502,requestId);
  }
  let encrypted:{ciphertext:string;iv:string;keyVersion:string};
  try{encrypted=await encryptCheckoutSecretPayload(clientSecret);}catch(e){await admin.from("subscription_payment_intents").update({provider_creation_state:"RECONCILIATION_REQUIRED",updated_at:new Date().toISOString()}).eq("id",claimedIntent.id).eq("provider_creation_state","CLAIMED");console.error(JSON.stringify({requestId,stage:"encrypt_checkout_secret",error:e instanceof Error?e.message:"UNKNOWN"}));return json({error:"CHECKOUT_SECRET_ENCRYPTION_FAILED",requestId},503,requestId);}
  const { data: updated, error: updateError } = await admin.from("subscription_payment_intents").update({status:"PENDING",provider_intent_id:providerIntentId,provider_order_id:providerOrderId,provider_creation_state:"CORRELATED",client_secret_ciphertext:encrypted.ciphertext,client_secret_iv:encrypted.iv,client_secret_key_version:encrypted.keyVersion,updated_at:new Date().toISOString()}).eq("id",claimedIntent.id).eq("provider_creation_state","CLAIMED").select().single();
  if(updateError||!updated){console.error(JSON.stringify({requestId,stage:"persist_provider_intent",code:updateError?.code}));return json({error:"SUBSCRIPTION_PAYMENT_PERSISTENCE_FAILED",requestId},500,requestId);}
  const checkoutUrl=`https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
  return json({paymentIntent:updated,clientSecret,checkoutUrl,requestId},200,requestId);
 }catch(e){console.error(JSON.stringify({requestId,stage:"unhandled",error:e instanceof Error?e.message:"UNKNOWN"}));return json({error:"SUBSCRIPTION_PAYMENT_FAILED",requestId},500,requestId);}
});