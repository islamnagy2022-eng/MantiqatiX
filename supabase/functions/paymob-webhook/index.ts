import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { matchesPaymobAmountCents } from "../_shared/paymob-intent-correlation.mjs"
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??""
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""
const HMAC_SECRET=Deno.env.get("PAYMOB_HMAC_SECRET")??""
const admin=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}})
const json=(body:unknown,status=200,requestId="")=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Request-Id":requestId}})
const value=(v:unknown)=>v===null||v===undefined?"":typeof v==="boolean"?(v?"true":"false"):String(v)
async function hmacSha512Hex(secret:string,input:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-512"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(input));return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
async function verify(obj:Record<string,unknown>,order:Record<string,unknown>,source:Record<string,unknown>,supplied:string){if(!HMAC_SECRET||!supplied)return false;const plain=[obj.amount_cents,obj.created_at,obj.currency,obj.error_occured,obj.has_parent_transaction,obj.id,obj.integration_id,obj.is_3d_secure,obj.is_auth,obj.is_capture,obj.is_refunded,obj.is_standalone_payment,obj.is_voided,order.id,obj.owner,obj.pending,source.pan,source.sub_type,source.type,obj.success].map(value).join("");return safeEqual((await hmacSha512Hex(HMAC_SECRET,plain)).toLowerCase(),supplied.toLowerCase())}
Deno.serve(async req=>{const requestId=req.headers.get("x-request-id")||crypto.randomUUID();try{
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED",requestId},405,requestId);if(!HMAC_SECRET)return json({error:"PAYMENT_CALLBACK_NOT_CONFIGURED",requestId},503,requestId)
 const raw=await req.json().catch(()=>null) as Record<string,unknown>|null;if(!raw)return json({error:"INVALID_JSON",requestId},400,requestId)
 const obj=(raw.obj&&typeof raw.obj==="object"?raw.obj:raw) as Record<string,unknown>;const order=(obj.order&&typeof obj.order==="object"?obj.order:{}) as Record<string,unknown>;const source=(obj.source_data&&typeof obj.source_data==="object"?obj.source_data:{}) as Record<string,unknown>
 if(!(await verify(obj,order,source,value(raw.hmac??obj.hmac))))return json({error:"INVALID_PROVIDER_SIGNATURE",requestId},401,requestId)
 const eventId=`paymob:${value(obj.id)}`;const merchantRef=value(order.merchant_order_id);const paymobOrderId=value(order.id);const amount=Number(obj.amount_cents??0)/100;const currency=value(obj.currency).toUpperCase();const success=obj.success===true||value(obj.success).toLowerCase()==="true"
 if(!value(obj.id)||amount<=0||!currency||!Number.isFinite(amount))return json({error:"INVALID_PROVIDER_EVENT",requestId},400,requestId)
 const {data:subByRef}=await admin.from("subscription_payment_intents").select("id,business_id,amount,currency,status,provider_order_id").eq("provider","PAYMOB").eq("id",merchantRef).maybeSingle()
 const {data:subByOrder}=subByRef?{data:null}:await admin.from("subscription_payment_intents").select("id,business_id,amount,currency,status,provider_order_id").eq("provider","PAYMOB").eq("provider_order_id",paymobOrderId).maybeSingle()
 const sub=subByRef??subByOrder
 if(sub){
   if(!paymobOrderId||String(sub.provider_order_id??"")!==paymobOrderId)return json({error:"SUBSCRIPTION_PROVIDER_ORDER_MISMATCH",requestId},409,requestId)
   if(!matchesPaymobAmountCents(sub.amount,obj.amount_cents)||String(sub.currency).toUpperCase()!==currency)return json({error:"SUBSCRIPTION_AMOUNT_CURRENCY_MISMATCH",requestId},409,requestId)
   const {data:existing}=await admin.from("payment_provider_events").select("id,raw_payload").eq("provider","PAYMOB").eq("external_event_id",eventId).maybeSingle();if(existing){const existingPayload=(existing.raw_payload as Record<string,unknown>|null)??{};const existingIntentId=String(existingPayload.subscription_payment_intent_id??"");const existingOrderId=String(existingPayload.provider_order_id??"");const existingTransactionId=String(existingPayload.provider_transaction_id??"");if(existingIntentId!==String(sub.id)||existingOrderId!==paymobOrderId||existingTransactionId!==value(obj.id))return json({error:"SUBSCRIPTION_EVENT_CORRELATION_MISMATCH",requestId},409,requestId);return json({ok:true,idempotent:true,requestId},200,requestId)}
    const subscriptionPayload={provider:"PAYMOB",transaction_id:value(obj.id),merchant_order_id:sub.id,provider_order_id:paymobOrderId,currency,success:success?"true":"false",amount_cents:value(obj.amount_cents)};
    if(!success){const {data:failed,error:failureError}=await admin.rpc("process_verified_subscription_payment_failure",{p_event_id:"paymob-sub-fail:"+value(obj.id),p_external_event_id:eventId,p_subscription_payment_intent_id:sub.id,p_provider_transaction_id:value(obj.id),p_provider_confirmed_amount:amount,p_provider_confirmed_currency:currency,p_provider_order_id:paymobOrderId,p_signature_verified:true,p_raw_payload:subscriptionPayload});if(failureError)return json({error:"SUBSCRIPTION_FAILURE_PERSISTENCE",requestId},500,requestId);return json({ok:true,status:String(failed?.status??"FAILED"),result:failed,requestId},200,requestId)}
    const {data:processed,error:e}=await admin.rpc("process_verified_subscription_payment_backend",{p_event_id:"paymob-sub:"+value(obj.id),p_external_event_id:eventId,p_subscription_payment_intent_id:sub.id,p_provider_transaction_id:value(obj.id),p_provider_confirmed_amount:amount,p_provider_confirmed_currency:currency,p_provider_order_id:paymobOrderId,p_signature_verified:true,p_raw_payload:subscriptionPayload});if(e)return json({error:"SUBSCRIPTION_PAYMENT_PROCESSING_FAILED",requestId},500,requestId);return json({ok:true,status:String(processed?.status??"ACTIVE"),result:processed,requestId},200,requestId)
 }
 const {data:digitalByRef}=await admin.from("digital_page_orders").select("id,user_id,amount,currency,payment_status,provider_order_id").eq("provider","PAYMOB").eq("id",merchantRef).maybeSingle()
 const {data:digitalByOrder}=digitalByRef?{data:null}:await admin.from("digital_page_orders").select("id,user_id,amount,currency,payment_status,provider_order_id").eq("provider","PAYMOB").eq("provider_order_id",paymobOrderId).maybeSingle()
 const digital=digitalByRef??digitalByOrder
 if(digital){
   if(!paymobOrderId||String(digital.provider_order_id??"")!==paymobOrderId)return json({error:"DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH",requestId},409,requestId)
   if(!matchesPaymobAmountCents(digital.amount,obj.amount_cents)||String(digital.currency).toUpperCase()!==currency)return json({error:"DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH",requestId},409,requestId)
   const {data:processedDigital,error:processError}=await admin.rpc("process_verified_digital_page_payment_backend",{
     p_order_id:digital.id,
     p_external_event_id:eventId,
     p_event_type:"TRANSACTION",
     p_status:success?"SUCCEEDED":"FAILED",
     p_signature_verified:true,
     p_amount:amount,
     p_currency:currency,
     p_provider_transaction_id:value(obj.id),
     p_provider_order_id:paymobOrderId,
     p_raw_payload:raw
   })
   if(processError){
     const message=String(processError.message??"")
     if(message.includes("DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH"))return json({error:"DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH",requestId},409,requestId)
     if(message.includes("DIGITAL_PAGE_ORDER_NOT_FOUND"))return json({error:"DIGITAL_PAGE_ORDER_NOT_FOUND",requestId},404,requestId)
     if(message.includes("DIGITAL_PAGE_EVENT_ORDER_MISMATCH"))return json({error:"DIGITAL_PAGE_EVENT_ORDER_MISMATCH",requestId},409,requestId)
     return json({error:"DIGITAL_PAGE_PAYMENT_PROCESSING_FAILED",requestId},500,requestId)
   }
   const result=processedDigital&&typeof processedDigital==="object"?processedDigital as Record<string,unknown>:{}
   if(result.idempotent===true)return json({ok:true,idempotent:true,status:value(result.payment_status),requestId},200,requestId)
   if(result.already_final!==true){
     const paid=value(result.payment_status)==="PAID"
     const {error:ne}=await admin.from("notifications").insert({id:crypto.randomUUID(),tenant_id:"MNTY-PLATFORM",user_id:digital.user_id,type:"DIGITAL_PAGE_PAYMENT",title:paid?"تم تأكيد الدفع":"تعذر تأكيد الدفع",body:paid?"تم تأكيد طلب الصفحة الرقمية وسيبدأ فريق المنصة مراجعته.":"تعذر تأكيد عملية الدفع لطلب الصفحة الرقمية.",entity_type:"digital_page_order",entity_id:digital.id})
     if(ne)console.error("DIGITAL_PAGE_PAYMENT_NOTIFICATION_FAILED",requestId,ne.message)
   }
   return json({ok:true,status:value(result.payment_status),fulfillmentStatus:value(result.fulfillment_status),requestId},200,requestId)
 }
  const {data:mantigo}=await admin.from("mantigo_financial_ledger").select("id,ride_id,customer_id,currency,gross_amount,payment_status,settlement_status,metadata").eq("id",merchantRef).maybeSingle();
  if(mantigo){
    if(!matchesPaymobAmountCents(mantigo.gross_amount,obj.amount_cents)||String(mantigo.currency).toUpperCase()!==currency)return json({error:"MANTIGO_AMOUNT_CURRENCY_MISMATCH",requestId},409,requestId);
    const providerOrderId=value(order.id);
    if(!providerOrderId||providerOrderId!==value((mantigo.metadata as Record<string,unknown>|null)?.paymob_intention_order_id))return json({error:"MANTIGO_PROVIDER_ORDER_MISMATCH",requestId},409,requestId);
    const nextStatus=success?"PAID":"FAILED";
    const mantigoPayload={provider:"PAYMOB",transaction_id:value(obj.id),merchant_order_id:mantigo.id,provider_order_id:providerOrderId,currency,success:success?"true":"false",amount_cents:value(obj.amount_cents)};
    const {data:processed,error:processError}=await admin.rpc("process_verified_mantigo_payment_backend",{p_ledger_id:mantigo.id,p_external_event_id:eventId,p_status:nextStatus,p_signature_verified:true,p_amount:amount,p_currency:currency,p_provider_transaction_id:value(obj.id),p_raw_payload:mantigoPayload});
    if(processError){console.error("MANTIGO_ATOMIC_PAYMENT_FAILED",requestId,processError.message);return json({error:"MANTIGO_PAYMENT_PROCESSING_FAILED",requestId},500,requestId);}
    const result=processed&&typeof processed==="object"?processed as Record<string,unknown>:{};
    return json({ok:true,idempotent:result.idempotent===true,status:value(result.status)||nextStatus,requestId},200,requestId);
  }
const {data:intentByRef}=await admin.from("payment_intents").select("id,tenant_id,order_id,amount,currency,status,pricing_version,pricing_hash,provider_order_id").eq("id",merchantRef).maybeSingle()
 const {data:intentByOrder}=intentByRef?{data:null}:await admin.from("payment_intents").select("id,tenant_id,order_id,amount,currency,status,pricing_version,pricing_hash,provider_order_id").eq("provider","PAYMOB").eq("provider_order_id",paymobOrderId).maybeSingle()
 const intent=intentByRef??intentByOrder;if(!intent)return json({error:"PAYMENT_INTENT_NOT_FOUND",requestId},404,requestId)
 if(!paymobOrderId||String(intent.provider_order_id??"")!==paymobOrderId)return json({error:"PAYMENT_PROVIDER_ORDER_MISMATCH",requestId},409,requestId)
 if(!matchesPaymobAmountCents(intent.amount,obj.amount_cents)||String(intent.currency).toUpperCase()!==currency)return json({error:"PAYMENT_AMOUNT_CURRENCY_MISMATCH",requestId},409,requestId)
 const {data:existing}=await admin.from("payment_provider_events").select("id,payment_intent_id").eq("provider","PAYMOB").eq("external_event_id",eventId).maybeSingle();if(existing){if(String(existing.payment_intent_id??"")!==String(intent.id))return json({error:"PAYMENT_EVENT_INTENT_MISMATCH",requestId},409,requestId);return json({ok:true,idempotent:true,requestId},200,requestId)}
  if(!success){const failurePayload={provider:"PAYMOB",transaction_id:value(obj.id),merchant_order_id:intent.order_id,provider_order_id:paymobOrderId,currency,success:"false",amount_cents:value(obj.amount_cents)};const {data:failed,error:e}=await admin.rpc("process_verified_provider_payment_failure",{p_event_id:"paymob-fail:"+value(obj.id),p_tenant_id:String(intent.tenant_id),p_provider:"PAYMOB",p_external_event_id:eventId,p_payment_intent_id:String(intent.id),p_event_type:"TRANSACTION",p_signature_verified:true,p_provider_confirmed_amount:amount,p_provider_confirmed_currency:currency,p_provider_transaction_id:value(obj.id),p_provider_order_id:paymobOrderId,p_raw_payload:failurePayload});if(e)return json({error:"PAYMENT_FAILURE_PERSISTENCE",requestId},500,requestId);return json({ok:true,status:String(failed?.status??"FAILED"),result:failed,requestId},200,requestId)}
 const {data:processed,error:e}=await admin.rpc("process_verified_provider_payment",{p_event_id:eventId,p_tenant_id:intent.tenant_id,p_provider:"PAYMOB",p_external_event_id:eventId,p_payment_intent_id:intent.id,p_event_type:"TRANSACTION",p_signature_verified:true,p_provider_confirmed_amount:amount,p_provider_confirmed_currency:currency,p_platform_received_amount:amount});if(e)return json({error:"PAYMENT_PROCESSING_FAILED",requestId},500,requestId);return json({ok:true,status:"SUCCEEDED",result:processed,requestId},200,requestId)
}catch(e){return json({error:"CALLBACK_FAILED",requestId},500,requestId)}})