import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req)=>{
 const origin=req.headers.get("Origin");
 if(req.method==="OPTIONS"){if(origin&&origin!==allowedOrigin)return out({error:"ORIGIN_NOT_ALLOWED"},403);return new Response("ok",{status:200,headers:corsHeaders});}
 if(origin&&origin!==allowedOrigin)return out({error:"ORIGIN_NOT_ALLOWED"},403);
 if(req.method!=="POST") return out({error:"METHOD_NOT_ALLOWED"},405);
 const h=req.headers.get("Authorization")??"";
 if(!h.startsWith("Bearer ")) return out({error:"AUTH_REQUIRED"},401);
 const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return out({error:"SERVER_MISCONFIGURED"},500);
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await admin.auth.getUser(h.slice(7).trim());
 if(error||!data.user||data.user.is_anonymous)return out({error:"UNAUTHORIZED"},401);
 const maxBodyBytes=16*1024;
 const contentLength=Number(req.headers.get("Content-Length")||0);
 if(Number.isFinite(contentLength)&&contentLength>maxBodyBytes)return out({error:"PAYLOAD_TOO_LARGE"},413);
 let body:any;
 try{
  const raw=await req.text();
  if(new TextEncoder().encode(raw).byteLength>maxBodyBytes)return out({error:"PAYLOAD_TOO_LARGE"},413);
  body=JSON.parse(raw);
 }catch{return out({error:"INVALID_JSON"},400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return out({error:"INVALID_BODY"},400);
 const isUuid=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
 if(!isUuid(body.orderId))return out({error:"INVALID_ORDER_ID"},400);
 if(typeof body.tenantId!=="string"||!body.tenantId.trim()||body.tenantId.length>120)return out({error:"INVALID_TENANT_ID"},400);
 const newStatus=typeof body.newStatus==="string"?body.newStatus.trim().toUpperCase():"";
 if(!["PENDING","CREATED","CONFIRMED","PREPARING","OUT_FOR_DELIVERY","DELIVERED","CANCELLED"].includes(newStatus))return out({error:"INVALID_ORDER_STATUS"},400);
 if(body.reason!==undefined&&body.reason!==null&&(typeof body.reason!=="string"||body.reason.length>1000))return out({error:"INVALID_REASON"},400);
 const {data:result,error:rpcError}=await admin.rpc("update_order_status_backend",{p_order_id:body.orderId,p_tenant_id:body.tenantId.trim(),p_user_id:data.user.id,p_new_status:newStatus,p_reason:body.reason??null});
 if(rpcError)return out({error:"ORDER_STATUS_UPDATE_FAILED"},400);
 return out(result);
});