import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
function code(name:string){return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,24)+"-"+crypto.randomUUID().slice(0,8).toUpperCase();}
Deno.serve(async(req)=>{
  const origin=req.headers.get("Origin");
  if(req.method==="OPTIONS"){if(origin&&origin!==allowedOrigin)return out({error:"ORIGIN_NOT_ALLOWED"},403);return new Response("ok",{status:200,headers:cors});}
  if(origin&&origin!==allowedOrigin)return out({error:"ORIGIN_NOT_ALLOWED"},403);
  if(req.method!=="POST")return out({error:"METHOD_NOT_ALLOWED"},405);
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return out({error:"AUTH_REQUIRED"},401);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return out({error:"SERVER_MISCONFIGURED"},500);
  const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:ue}=await db.auth.getUser(auth.slice(7).trim());
  if(ue||!user||user.is_anonymous)return out({error:"UNAUTHORIZED"},401);
  let body:any;try{body=await req.json()}catch{return out({error:"INVALID_JSON"},400)}
  const tenantId=String(body.tenantId??"").trim(),businessId=String(body.businessId??"").trim(),name=String(body.name??"").trim();
  if(!tenantId||!businessId||!name)return out({error:"TENANT_BUSINESS_NAME_REQUIRED"},400);
  if(name.length>200)return out({error:"FIELD_TOO_LONG"},400);
  const {data:membership,error:me}=await db.from("user_memberships").select("id,role,business_id,status,permissions").eq("user_id",user.id).eq("tenant_id",tenantId).eq("status","ACTIVE").or(`business_id.eq.${businessId},business_id.is.null`).order("id").limit(20);\n  if(me)return out({error:"MEMBERSHIP_READ_FAILED"},500);\n  const allowed=(membership||[]).some((m:any)=>["OWNER","ADMIN","BUSINESS_OWNER","MANAGER"].includes(String(m.role).toUpperCase())&&String(m.business_id||"")===businessId)\n    || (membership||[]).some((m:any)=>String(m.role).toUpperCase()==="SUPER_ADMIN"&&String(m.business_id||"")===""&&m.permissions?.scope==="PLATFORM"&&m.permissions?.full_control===true);\n  if(!allowed)return out({error:"BUSINESS_MANAGEMENT_REQUIRED"},403);\n  const {data:business,error:be}=await db.from("businesses").select("id,status,organization_id").eq("id",businessId).eq("tenant_id",tenantId).single();
  if(be||!business)return out({error:"BUSINESS_NOT_FOUND"},404);
  if(String(business.status).toUpperCase()!=="ACTIVE")return out({error:"BUSINESS_NOT_ACTIVE"},409);
  const branchId=crypto.randomUUID(), branchCode=code(name);
  const {data:branch,error:ie}=await db.from("branches").insert({
    id:branchId,tenant_id:tenantId,organization_id:body.organizationId??business.organization_id??null,business_id:businessId,
    name,code:branchCode,status:"ACTIVE",phone:body.phone?String(body.phone).trim():null,address:body.address?String(body.address).trim():null,
    latitude:body.latitude==null?null:Number(body.latitude),longitude:body.longitude==null?null:Number(body.longitude),
    settings:{source:"MNTY_PROVIDER_ONBOARDING"}
  }).select("id,tenant_id,organization_id,business_id,name,code,status,phone,address,latitude,longitude").single();
  if(ie)return out({error:ie.message||"BRANCH_CREATE_FAILED"},400);
  return out({success:true,branch});
});