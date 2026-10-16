import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")??"";
const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const secretKey=Deno.env.get("PAYMOB_SECRET_KEY")??"";
const publicKey=Deno.env.get("PAYMOB_PUBLIC_KEY")??"";
const integrationId=Deno.env.get("PAYMOB_INTEGRATION_ID")??"";
const encryptionKeyVersion=(Deno.env.get("PAYMOB_CLIENT_SECRET_KEY_VERSION")??"v1").trim();
const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(body:unknown,status=200,requestId?:string)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...(requestId?{"X-Request-Id":requestId}:{})}});
type Row=Record<string,unknown>;
const asRow=(v:unknown):Row|null=>{if(Array.isArray(v))return v[0]&&typeof v[0]==="object"?v[0] as Row:null;return v&&typeof v==="object"?v as Row:null;};
const str=(v:unknown)=>v===null||v===undefined?"":String(v);
const b64=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(""));
const unb64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const keyEnvName=(version:string)=>"PAYMOB_CLIENT_SECRET_ENCRYPTION_KEY_"+version.toUpperCase().replace(/[^A-Z0-9]/g,"_");
function rawEncryptionKey(version:string):Uint8Array|null{
 const configured=Deno.env.get(keyEnvName(version))??(version===encryptionKeyVersion?Deno.env.get("PAYMOB_CLIENT_SECRET_ENCRYPTION_KEY"):null);
 if(!configured)return null;
 try{const bytes=unb64(configured.trim());return bytes.length===32?bytes:null;}catch{return null;}
}
async function cryptoKey(version:string){
 const raw=rawEncryptionKey(version);
 if(!raw)throw new Error("CHECKOUT_ENCRYPTION_KEY_UNAVAILABLE");
 return await crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
async function encryptSecret(secret:string,version:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await cryptoKey(version);
 const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(secret));
 return {ciphertext:b64(new Uint8Array(ciphertext)),iv:b64(iv)};
}
async function decryptSecret(ciphertext:string,iv:string,version:string){
 const key=await cryptoKey(version);
 const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(iv)},key,unb64(ciphertext));
 return new TextDecoder().decode(clear);
}
function checkoutResponse(intent:Row,clientSecret:string,requestId:string){
 const {
  client_secret_ciphertext: _ciphertext,
  client_secret_iv: _iv,
  client_secret_key_version: _keyVersion,
  ...safeIntent
 }=intent;
 const checkoutUrl=publicKey?"https://accept.paymob.com/unifiedcheckout/?publicKey="+encodeURIComponent(publicKey)+"&clientSecret="+encodeURIComponent(clientSecret):null;
 return json({paymentIntent:safeIntent,clientSecret,checkoutUrl,amount:Number(intent.amount),currency:str(intent.currency),requestId},200,requestId);
}
async function recoverCheckout(intent:Row,requestId:string){
 const ciphertext=str(intent.client_secret_ciphertext),iv=str(intent.client_secret_iv),version=str(intent.client_secret_key_version);
 if(!ciphertext||!iv||!version)return json({error:"SUBSCRIPTION_CHECKOUT_RECOVERY_UNAVAILABLE",reconciliationRequired:true,requestId},409,requestId);
 try{return checkoutResponse(intent,await decryptSecret(ciphertext,iv,version),requestId);}
 catch(e){console.error(JSON.stringify({requestId,stage:"decrypt_checkout_secret",keyVersion:version,error:e instanceof Error?e.message:"UNKNOWN"}));return json({error:"SUBSCRIPTION_CHECKOUT_RECOVERY_KEY_UNAVAILABLE",reconciliationRequired:true,requestId},503,requestId);}
}
Deno.serve(async req=>{
 const requestId=req.headers.get("x-request-id")||crypto.randomUUID();
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405,requestId);
 const auth=req.headers.get("Authorization")??"";
 if(!auth.startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401,requestId);
 try{
  const {data:{user},error:userError}=await admin.auth.getUser(auth.slice(7));
  if(userError||!user||user.is_anonymous)return json({error:"AUTH_REQUIRED"},401,requestId);
  if(!secretKey||!publicKey||!integrationId)return json({error:"PAYMENT_PROVIDER_NOT_CONFIGURED",requestId},503,requestId);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body)return json({error:"INVALID_JSON"},400,requestId);
  const businessId=str(body.businessId).trim();
  const tierCode=str(body.tierCode).trim().toUpperCase();
  const billingCycle=str(body.billingCycle).trim().toUpperCase();
  const sector=str(body.sector).trim();
  const idempotencyKey=str(body.idempotencyKey).trim();
  if(!businessId||!tierCode||!["MONTHLY","ANNUAL"].includes(billingCycle)||!idempotencyKey)return json({error:"INVALID_REQUEST"},400,requestId);

  // RC435 claimable creation prevents a retry from silently creating a second Paymob intention.
  const {data:intentData,error:intentError}=await admin.rpc("create_subscription_payment_intent_claimable_backend",{
    p_business_id:businessId,p_tier_code:tierCode,p_billing_cycle:billingCycle,p_sector:sector||null,
    p_idempotency_key:idempotencyKey,p_actor_user_id:user.id
  });
  const intent=asRow(intentData);
  if(intentError||!intent){
    console.error(JSON.stringify({requestId,stage:"create_claimable_intent",code:intentError?.code}));
    const message=str(intentError?.message);
    if(message.includes("SUBSCRIPTION_FORBIDDEN"))return json({error:"FORBIDDEN",requestId},403,requestId);
    if(message.includes("SUBSCRIPTION_IDEMPOTENCY_MISMATCH"))return json({error:"IDEMPOTENCY_KEY_MISMATCH",requestId},409,requestId);
    return json({error:"SUBSCRIPTION_PAYMENT_INTENT_REJECTED",requestId},400,requestId);
  }
  if(str(intent.status).toUpperCase()==="SUCCEEDED")return json({paymentIntent:intent,requestId},200,requestId);

  if(str(intent.provider_intent_id)&&str(intent.provider_order_id)){
    if(str(intent.client_secret_ciphertext)&&str(intent.client_secret_iv)&&str(intent.client_secret_key_version))return await recoverCheckout(intent,requestId);
    return json({error:"SUBSCRIPTION_CHECKOUT_RECOVERY_UNAVAILABLE",reconciliationRequired:true,requestId},409,requestId);
  }

  const email=str(user.email).trim();
  const meta=(user.user_metadata??{}) as Record<string,unknown>;
  const phone=str(user.phone??meta.phone??meta.phone_number).trim();
  const firstName=str(meta.first_name??meta.firstName??user.email?.split("@")[0]??"Customer").slice(0,50);
  const lastName=str(meta.last_name??meta.lastName??"Customer").slice(0,50);
  if(!email||!phone)return json({error:"CUSTOMER_BILLING_CONTACT_REQUIRED",requestId},422,requestId);

  // Validate the active encryption key and billing data before claiming an attempt.
  if(!rawEncryptionKey(encryptionKeyVersion))return json({error:"CHECKOUT_ENCRYPTION_KEY_NOT_CONFIGURED",requestId},503,requestId);
  const {data:claimData,error:claimError}=await admin.rpc("claim_subscription_provider_intent_creation_backend",{
    p_intent_id:str(intent.id),p_actor_user_id:user.id
  });
  const claim=asRow(claimData);
  if(claimError||!claim){
    console.error(JSON.stringify({requestId,stage:"claim_provider_intent",code:claimError?.code}));
    return json({error:"SUBSCRIPTION_PROVIDER_INTENT_CLAIM_FAILED",requestId},500,requestId);
  }
  const claimedIntent=asRow(claim.intent)??intent;
  if(claim.claimed!==true){
    if(claim.outcome_unknown===true)return json({error:"SUBSCRIPTION_PROVIDER_INTENT_RECONCILIATION_REQUIRED",reconciliationRequired:true,requestId},409,requestId);
    if(str(claimedIntent.provider_intent_id)&&str(claimedIntent.provider_order_id))return await recoverCheckout(claimedIntent,requestId);
    return json({error:"SUBSCRIPTION_PROVIDER_INTENT_NOT_READY",requestId},409,requestId);
  }

  let paymob:Record<string,unknown>|null=null;
  try{
    const response=await fetch("https://accept.paymob.com/v1/intention/",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Token ${secretKey}`},
      body:JSON.stringify({
        amount:Math.round(Number(claimedIntent.amount)*100),currency:str(claimedIntent.currency),
        payment_methods:[Number(integrationId)],special_reference:`MANTIQATIX-SUB-${str(claimedIntent.id)}`,items:[],
        billing_data:{first_name:firstName,last_name:lastName,email,phone_number:phone,country:"EGY",city:"NA",street:"NA",building:"NA",floor:"NA",apartment:"NA",postal_code:"NA",state:"NA"},
        extras:{mantiqatix_payment_intent_id:claimedIntent.id,business_id:businessId,tier_code:tierCode,billing_cycle:billingCycle}
      })
    });
    paymob=await response.json().catch(()=>null) as Record<string,unknown>|null;
    if(!response.ok||!paymob){
      console.error(JSON.stringify({requestId,stage:"paymob_intention",status:response.status}));
      return json({error:"PAYMOB_INTENTION_FAILED",reconciliationRequired:true,requestId},502,requestId);
    }
  }catch(e){
    console.error(JSON.stringify({requestId,stage:"paymob_intention_network",error:e instanceof Error?e.message:"UNKNOWN"}));
    return json({error:"PAYMOB_INTENTION_OUTCOME_UNKNOWN",reconciliationRequired:true,requestId},502,requestId);
  }

  const providerIntentId=str(paymob.id);
  const providerOrderId=str(paymob.intention_order_id??paymob.order_id).trim();
  const clientSecret=str(paymob.client_secret);
  if(!providerIntentId||!providerOrderId||!clientSecret){
    console.error(JSON.stringify({requestId,stage:"paymob_intention_shape",hasIntent:!!providerIntentId,hasOrder:!!providerOrderId,hasSecret:!!clientSecret}));
    return json({error:"PAYMOB_INTENTION_CORRELATION_INCOMPLETE",reconciliationRequired:true,requestId},502,requestId);
  }
  const encrypted=await encryptSecret(clientSecret,encryptionKeyVersion);
  const {data:finalizedData,error:finalizeError}=await admin.rpc("finalize_subscription_provider_intent_creation_backend",{
    p_intent_id:str(claimedIntent.id),p_actor_user_id:user.id,p_provider_intent_id:providerIntentId,p_provider_order_id:providerOrderId,
    p_client_secret_ciphertext:encrypted.ciphertext,p_client_secret_iv:encrypted.iv,p_client_secret_key_version:encryptionKeyVersion
  });
  const finalized=asRow(finalizedData);
  if(finalizeError||!finalized){
    console.error(JSON.stringify({requestId,stage:"finalize_provider_intent",code:finalizeError?.code}));
    return json({error:"SUBSCRIPTION_PROVIDER_CORRELATION_PERSISTENCE_FAILED",reconciliationRequired:true,requestId},500,requestId);
  }
  return checkoutResponse(finalized,clientSecret,requestId);
 }catch(e){
  console.error(JSON.stringify({requestId,stage:"unhandled",error:e instanceof Error?e.message:"UNKNOWN"}));
  return json({error:"SUBSCRIPTION_PAYMENT_FAILED",requestId},500,requestId);
 }
});
