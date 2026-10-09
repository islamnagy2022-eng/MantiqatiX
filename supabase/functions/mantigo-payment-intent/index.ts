import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const PAYMOB_SECRET_KEY=Deno.env.get("PAYMOB_SECRET_KEY")??"";
const PAYMOB_PUBLIC_KEY=Deno.env.get("PAYMOB_PUBLIC_KEY")??"";
const PAYMOB_INTEGRATION_ID=Deno.env.get("PAYMOB_INTEGRATION_ID")??"";
const PAYMOB_CALLBACK_URL=Deno.env.get("PAYMOB_CALLBACK_URL")??`${SUPABASE_URL}/functions/v1/paymob-webhook`;
const admin=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}});
const allowedOrigin="https://islamnagy2022-eng.github.io";
const headers={"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const json=(body:unknown,status=200,id?:string)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json","Cache-Control":"no-store",...(id?{"X-Request-Id":id}:{})}});
Deno.serve(async req=>{
 const requestId=crypto.randomUUID();
 try{
  const origin=req.headers.get("Origin");
  if(req.method==="OPTIONS") return origin&&origin!==allowedOrigin?json({error:"ORIGIN_NOT_ALLOWED"},403,requestId):new Response("ok",{headers});
  if(origin&&origin!==allowedOrigin)return json({error:"ORIGIN_NOT_ALLOWED"},403,requestId);
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405,requestId);
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer "))return json({error:"UNAUTHORIZED"},401,requestId);
  const token=auth.slice(7);
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user||user.is_anonymous)return json({error:"UNAUTHORIZED"},401,requestId);
  if(!PAYMOB_SECRET_KEY||!PAYMOB_INTEGRATION_ID)return json({error:"ELECTRONIC_PAYMENT_GATEWAY_NOT_CONFIGURED"},503,requestId);
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  const rideId=String(body?.rideId??"");
  if(!rideId)return json({error:"RIDE_ID_REQUIRED"},400,requestId);

  const {data:ledger,error:ledgerError}=await admin.from("mantigo_financial_ledger")
    .select("id,ride_id,customer_id,currency,gross_amount,payment_status,provider,provider_intent_id,metadata")
    .eq("ride_id",rideId).eq("customer_id",user.id).single();
  if(ledgerError||!ledger)return json({error:"FINANCIAL_RECORD_NOT_FOUND"},404,requestId);
  if(!["REQUIRED","PENDING"].includes(String(ledger.payment_status)))return json({error:"RIDE_NOT_PAYABLE",paymentStatus:ledger.payment_status},409,requestId);

  const metadata=(ledger.metadata&&typeof ledger.metadata==="object"?ledger.metadata:{}) as Record<string,unknown>;
  if(ledger.provider==="PAYMOB"&&ledger.provider_intent_id&&metadata.paymob_client_secret){
    return json({id:ledger.id,provider:"PAYMOB",status:"PENDING",amount:Number(ledger.gross_amount),currency:String(ledger.currency).toUpperCase(),clientSecret:String(metadata.paymob_client_secret),checkoutUrl:PAYMOB_PUBLIC_KEY?`https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(PAYMOB_PUBLIC_KEY)}&clientSecret=${encodeURIComponent(String(metadata.paymob_client_secret))}`:null,requestId},200,requestId);
  }

  const amount=Number(ledger.gross_amount);
  const currency=String(ledger.currency||"EGP").toUpperCase();
  if(!Number.isFinite(amount)||amount<=0)return json({error:"INVALID_FARE"},409,requestId);
  const amountCents=Math.round(amount*100);
  const name=String(user.user_metadata?.full_name??user.email?.split("@")[0]??"Customer");
  const parts=name.trim().split(/\s+/);
  const firstName=parts[0]||"Customer";
  const lastName=parts.slice(1).join(" ")||"Customer";
  const phone=String(user.phone??user.user_metadata?.phone??"").trim();
  const email=String(user.email??"").trim();
  if(!phone||!email)return json({error:"CUSTOMER_BILLING_CONTACT_REQUIRED"},422,requestId);
  const city=String(user.user_metadata?.city??"NA").trim()||"NA";
  const state=String(user.user_metadata?.state??city).trim()||"NA";

  const providerResponse=await fetch("https://accept.paymob.com/v1/intention/",{
    method:"POST",
    headers:{"Authorization":`Token ${PAYMOB_SECRET_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      amount:amountCents,currency,payment_methods:[Number(PAYMOB_INTEGRATION_ID)],
      items:[{name:"MantiGO Ride",amount:amountCents,description:`MantiGO ride ${rideId}`,quantity:1}],
      billing_data:{apartment:"NA",first_name:firstName,last_name:lastName,street:"NA",building:"NA",phone_number:phone,city,country:"EG",email,floor:"NA",state},
      special_reference:ledger.id,expiration:3600,notification_url:PAYMOB_CALLBACK_URL
    })
  });
  const provider=await providerResponse.json().catch(()=>({})) as Record<string,unknown>;
  const clientSecret=String(provider.client_secret??"");
  const providerIntentId=String(provider.id??"");
  const providerOrderId=String(provider.intention_order_id??provider.order_id??"");
  if(!providerResponse.ok||!clientSecret||!providerIntentId||!providerOrderId){
    console.error(JSON.stringify({requestId,stage:"paymob_intention",httpStatus:providerResponse.status}));
    return json({error:"PAYMENT_PROVIDER_REJECTED_INTENT"},502,requestId);
  }

  const nextMetadata={...metadata,paymob_client_secret:clientSecret,paymob_intention_order_id:providerOrderId,paymob_payment_methods:provider.payment_methods??null};
  const {error:updateError}=await admin.from("mantigo_financial_ledger").update({
    provider:"PAYMOB",provider_intent_id:providerIntentId,payment_method:"CARD",payment_status:"PENDING",metadata:nextMetadata,updated_at:new Date().toISOString()
  }).eq("id",ledger.id).eq("payment_status","REQUIRED");
  if(updateError)return json({error:"PAYMENT_INTENT_PERSISTENCE_FAILED"},500,requestId);
  return json({id:ledger.id,provider:"PAYMOB",status:"PENDING",amount,currency,clientSecret,checkoutUrl:PAYMOB_PUBLIC_KEY?`https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(PAYMOB_PUBLIC_KEY)}&clientSecret=${encodeURIComponent(clientSecret)}`:null,requestId},200,requestId);
 }catch(error){
  console.error(JSON.stringify({requestId,error:String(error)}));
  return json({error:"MANTIGO_PAYMENT_INTENT_FAILED"},500,requestId);
 }
});