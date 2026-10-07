import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL=Deno.env.get("SUPABASE_URL")??"";
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const ANON=Deno.env.get("SUPABASE_ANON_KEY")??"";
const PAYMOB_SECRET_KEY=Deno.env.get("PAYMOB_SECRET_KEY")??"";
const PAYMOB_INTEGRATION_ID=Deno.env.get("PAYMOB_INTEGRATION_ID")??"";
const PAYMOB_PUBLIC_KEY=Deno.env.get("PAYMOB_PUBLIC_KEY")??"";
const PAYMOB_BASE_URL=Deno.env.get("PAYMOB_BASE_URL")??"https://accept.paymob.com";
const CALLBACK=Deno.env.get("PAYMOB_CALLBACK_URL")??(URL+"/functions/v1/paymob-webhook");
const admin=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const origin="https://islamnagy2022-eng.github.io";
const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...headers,"Content-Type":"application/json","Cache-Control":"no-store"}});

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return json({});
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 if(req.headers.get("Origin")&&req.headers.get("Origin")!==origin)return json({error:"ORIGIN_NOT_ALLOWED"},403);
 const a=req.headers.get("Authorization");
 if(!a?.startsWith("Bearer "))return json({error:"UNAUTHORIZED"},401);
 const token=a.slice(7);
 const {data:{user},error:ae}=await admin.auth.getUser(token);
 if(ae||!user||user.is_anonymous)return json({error:"UNAUTHORIZED"},401);
 if(!PAYMOB_SECRET_KEY||!PAYMOB_INTEGRATION_ID||!ANON)return json({error:"PAYMENT_PROVIDER_NOT_CONFIGURED"},503);
 const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const orderId=String(body?.orderId??"").trim();
 const idem=String(body?.idempotencyKey??"").trim();
 if(!orderId||!idem)return json({error:"INVALID_REQUEST"},400);
 const email=String(user.email??"").trim();
 const phone=String(user.phone??"").trim();
 if(!email||!phone)return json({error:"CUSTOMER_BILLING_CONTACT_REQUIRED"},422);
 const userClient=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:a}}});
 const claimToken=crypto.randomUUID();
 const {data:claim,error:ce}=await userClient.rpc("claim_digital_page_payment_intent_backend",{p_order_id:orderId,p_user_id:user.id,p_idempotency_key:idem,p_claim_token:claimToken});
 if(ce){
   const message=String(ce.message??"");
   if(message.includes("ORDER_NOT_FOUND"))return json({error:"ORDER_NOT_FOUND"},404);
   if(message.includes("FORBIDDEN"))return json({error:"FORBIDDEN"},403);
   if(message.includes("IDEMPOTENCY_KEY_MISMATCH"))return json({error:"IDEMPOTENCY_KEY_MISMATCH"},409);
   if(message.includes("ALREADY_PAID"))return json({error:"ALREADY_PAID"},409);
   return json({error:"PAYMENT_CLAIM_FAILED"},500);
 }
 const row=Array.isArray(claim)?claim[0]:null;
 if(!row)return json({error:"PAYMENT_CLAIM_FAILED"},500);
 if(row.claim_status==="EXISTING")return json({orderId:row.id,status:row.payment_status,provider:"PAYMOB",clientSecret:null,checkoutUrl:null},200);
 if(row.claim_status==="IN_PROGRESS")return json({error:"PAYMENT_INTENT_IN_PROGRESS"},409);
 const release=async()=>{await userClient.rpc("release_digital_page_payment_intent_claim_backend",{p_order_id:orderId,p_user_id:user.id,p_claim_token:claimToken});};
 const amount=Number(row.amount);
 if(!Number.isFinite(amount)||amount<=0){await release();return json({error:"INVALID_AMOUNT"},409);}
 const amountCents=Math.round(amount*100);
 const payload={amount:amountCents,currency:String(row.currency||"EGP").toUpperCase(),payment_methods:[Number(PAYMOB_INTEGRATION_ID)],items:[{name:row.title,amount:amountCents,description:"MantiqaTix "+row.page_type+" page",quantity:1}],billing_data:{apartment:"NA",first_name:String(user.user_metadata?.full_name||email).split(" ")[0]||"Customer",last_name:"MantiqaTix",street:"NA",building:"NA",phone_number:phone,city:"NA",country:"EG",email,floor:"NA",state:"NA"},special_reference:row.id,expiration:3600,notification_url:CALLBACK};
 let p:Record<string,unknown>={};
 try{
   const res=await fetch(PAYMOB_BASE_URL.replace(/\/$/,"")+"/v1/intention/",{method:"POST",headers:{"Authorization":"Token "+PAYMOB_SECRET_KEY,"Content-Type":"application/json"},body:JSON.stringify(payload)});
   p=await res.json().catch(()=>({}));
   if(!res.ok||!p?.id||!p?.client_secret){await release();return json({error:"PAYMENT_PROVIDER_REJECTED"},502);}
 }catch{await release();return json({error:"PAYMENT_PROVIDER_UNAVAILABLE"},502);}
 const {data:finalized,error:fe}=await userClient.rpc("finalize_digital_page_payment_intent_backend",{p_order_id:orderId,p_user_id:user.id,p_claim_token:claimToken,p_provider_intent_id:String(p.id)});
 if(fe||finalized!==true)return json({error:"PAYMENT_PERSISTENCE_FAILED"},500);
 const clientSecret=String(p.client_secret);
 const checkoutUrl=PAYMOB_PUBLIC_KEY?(PAYMOB_BASE_URL.replace(/\/$/,"")+"/unifiedcheckout/?publicKey="+encodeURIComponent(PAYMOB_PUBLIC_KEY)+"&clientSecret="+encodeURIComponent(clientSecret)):null;
 return json({orderId:row.id,status:"PENDING",provider:"PAYMOB",clientSecret,checkoutUrl,amount,currency:row.currency});
});