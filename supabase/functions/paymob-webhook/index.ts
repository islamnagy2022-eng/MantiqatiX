import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
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
 if(!eventId||amount<=0||!currency)return json({error:"INVALID_PROVIDER_EVENT",requestId},400,requestId)
 const {data:subByRef}=await admin.from("subscription_payment_intents").select("id,business_id,amount,currency,status,provider_order_id").eq("provider","PAYMOB").eq("id",merchantRef).maybeSingle()
 const {data:subByOrder}=subByRef?{data:null}:await admin.from("subscription_payment_intents").select("id,business_id,amount,currency,status,provider_order_id").eq("provider","PAYMOB").eq("provider_order_id",paymobOrderId).maybeSingle()
 const sub=subByRef??subByOrder
 if(sub){
   if(Math.abs(Number(sub.amount)-amount)>0.01||String(sub.currency).toUpperCase()!==currency)return json({error:"SUBSCRIPTION_AMOUNT_CURRENCY_MISMATCH",requestId},409,requestId)
   const {data:existing}=await admin.from("payment_provider_events").select("id").eq("provider","PAYMOB").eq("external_event_id",eventId).maybeSingle();if(existing)return json({ok:true,idempotent:true,requestId},200,requestId)
   if(!success){const {error:e}=await admin.from("subscription_payment_intents").update({status:"FAILED",provider_transaction_id:value(obj.id),updated_at:new Date().toISOString()}).eq("id",sub.id).eq("status","PENDING");if(e)return json({error:"SUBSCRIPTION_FAILURE_PERSISTENCE",requestId},500,requestId);return json({ok:true,status:"FAILED",requestId},200,requestId)}
   const {data:processed,error:e}=await admin.rpc("process_verified_subscription_payment",{p_event_id:`paymob-sub:${value(obj.id)}`,p_external_event_id:eventId,p_subscription_payment_intent_id:sub.id,p_provider_transaction_id:value(obj.id),p_provider_confirmed_amount:amount,p_provider_confirmed_currency:currency,p_signature_verified:true});if(e)return json({error:"SUBSCRIPTION_PAYMENT_PROCESSING_FAILED",requestId},500,requestId);return json({ok:true,status:String(processed?.status??"ACTIVE"),result:processed,requestId},200,requestId)
 }
 const {data:digitalByRef}=await admin.from("digital_page_orders").select("id,user_id,amount,currency,payment_status,provider_order_id").eq("provider","PAYMOB").eq("id",merchantRef).maybeSingle()
 const {data:digitalByOrder}=digitalByRef?{data:null}:await admin.from("digital_page_orders").select("id,user_id,amount,currency,payment_status,provider_order_id").eq("provider","PAYMOB").eq("provider_order_id",paymobOrderId).maybeSingle()
 const digital=digitalByRef??digitalByOrder
 if(digital){
   if(Math.abs(Number(digital.amount)-amount)>0.01||String(digital.currency).toUpperCase()!==currency)return json({error:"DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH",requestId},409,requestId)
   const {data:existingDigital}=await admin.from("digital_page_payment_events").select("id").eq("external_event_id",eventId).maybeSingle()
   if(existingDigital)return json({ok:true,idempotent:true,requestId},200,requestId)
   const {error:ee}=await admin.from("digital_page_payment_events").insert({digital_page_order_id:digital.id,provider:"PAYMOB",external_event_id:eventId,event_type:"TRANSACTION",status:success?"SUCCEEDED":"FAILED",signature_verified:true,raw_payload:raw})
   if(ee)return json({error:"DIGITAL_PAGE_EVENT_PERSISTENCE",requestId},500,requestId)
   const next=success?"PAID":"FAILED"
   const fulfillment=success?"IN_REVIEW":"REQUESTED"
   const {error:oe}=await admin.from("digital_page_orders").update({payment_status:next,fulfillment_status:fulfillment,provider_transaction_id:value(obj.id),provider_order_id:paymobOrderId,updated_at:new Date().toISOString()}).eq("id",digital.id).eq("payment_status","PENDING")
   if(oe)return json({error:"DIGITAL_PAGE_ORDER_UPDATE_FAILED",requestId},500,requestId)
   await admin.from("notifications").insert({id:crypto.randomUUID(),tenant_id:"MNTY-PLATFORM",user_id:digital.user_id,type:"DIGITAL_PAGE_PAYMENT",title:success?"تم تأكيد الدفع":"تعذر تأكيد الدفع",body:success?"تم تأكيد طلب الصفحة الرقمية وسيبدأ فريق المنصة مراجعته.":"تعذر تأكيد عملية الدفع لطلب الصفحة الرقمية.",entity_type:"digital_page_order",entity_id:digital.id})
   return json({ok:true,status:next,requestId},200,requestId)
 }
 const {data:intentByRef}=await admin.from("payment_intents").select("id,tenant_id,order_id,amount,currency,status,pricing_version,pricing_hash").eq("id",merchantRef).maybeSingle()
 const {data:intentByOrder}=intentByRef?{data:null}:await admin.from("payment_intents").select("id,tenant_id,order_id,amount,currency,status,pricing_version,pricing_hash").eq("provider","PAYMOB").eq("provider_order_id",paymobOrderId).maybeSingle()
 const intent=intentByRef??intentByOrder;if(!intent)return json({error:"PAYMENT_INTENT_NOT_FOUND",requestId},404,requestId)
 if(Math.abs(Number(intent.amount)-amount)>0.01||String(intent.currency).toUpperCase()!==currency)return json({error:"PAYMENT_AMOUNT_CURRENCY_MISMATCH",requestId},409,requestId)
 const {data:existing}=await admin.from("payment_provider_events").select("id,payment_intent_id").eq("provider","PAYMOB").eq("external_event_id",eventId).maybeSingle();if(existing)return json({ok:true,idempotent:true,requestId},200,requestId)
 if(!success){const {error:e}=await admin.from("payment_provider_events").insert({id:crypto.randomUUID(),tenant_id:intent.tenant_id,provider:"PAYMOB",event_type:"TRANSACTION",payment_intent_id:intent.id,external_event_id:eventId,status:"FAILED",signature_verified:true,raw_payload:raw,processed_at:new Date().toISOString()});if(e)return json({error:"PAYMENT_FAILURE_PERSISTENCE",requestId},500,requestId);await admin.from("payment_intents").update({status:"FAILED",updated_at:new Date().toISOString()}).eq("id",intent.id);return json({ok:true,status:"FAILED",requestId},200,requestId)}
 const {data:processed,error:e}=await admin.rpc("process_verified_provider_payment",{p_event_id:eventId,p_tenant_id:intent.tenant_id,p_provider:"PAYMOB",p_external_event_id:eventId,p_payment_intent_id:intent.id,p_event_type:"TRANSACTION",p_signature_verified:true,p_provider_confirmed_amount:amount,p_provider_confirmed_currency:currency,p_platform_received_amount:amount});if(e)return json({error:"PAYMENT_PROCESSING_FAILED",requestId},500,requestId);return json({ok:true,status:"SUCCEEDED",result:processed,requestId},200,requestId)
}catch(e){return json({error:"CALLBACK_FAILED",requestId},500,requestId)}})