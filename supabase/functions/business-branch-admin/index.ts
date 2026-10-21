import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parseBranchCoordinates } from "../_shared/branch-coordinates.mjs";
import { isBranchCreationAuthorized } from "../_shared/branch-authorization.mjs";
import { parseBearerToken } from "../_shared/bearer-token.mjs";

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
  const token=parseBearerToken(req.headers.get("Authorization"));
  if(!token)return out({error:"AUTH_REQUIRED"},401);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return out({error:"SERVER_MISCONFIGURED"},500);
  const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:ue}=await db.auth.getUser(token);
  if(ue||!user||user.is_anonymous)return out({error:"UNAUTHORIZED"},401);
  const maxBodyBytes=16384;
  const contentLength=Number(req.headers.get("Content-Length")||"0");
  if(Number.isFinite(contentLength)&&contentLength>maxBodyBytes)return out({error:"REQUEST_TOO_LARGE"},413);
  if(!req.body)return out({error:"INVALID_JSON"},400);
  const reader=req.body.getReader(),chunks:Uint8Array[]=[];let totalBytes=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;totalBytes+=value.byteLength;if(totalBytes>maxBodyBytes){try{await reader.cancel()}catch{}return out({error:"REQUEST_TOO_LARGE"},413)}chunks.push(value)}
  }catch{try{await reader.cancel()}catch{}return out({error:"INVALID_JSON"},400)}
  const payload=new Uint8Array(totalBytes);let offset=0;for(const chunk of chunks){payload.set(chunk,offset);offset+=chunk.byteLength}
  let body:unknown;try{body=JSON.parse(new TextDecoder().decode(payload))}catch{return out({error:"INVALID_JSON"},400)}
  if(!body||typeof body!=="object"||Array.isArray(body))return out({error:"INVALID_REQUEST_BODY"},400);
  const input=body as Record<string,unknown>;
  if((input.tenantId!=null&&typeof input.tenantId!=="string")||(input.businessId!=null&&typeof input.businessId!=="string")||(input.name!=null&&typeof input.name!=="string"))return out({error:"INVALID_REQUEST_FIELDS"},400);
  const tenantId=String(input.tenantId??"").trim(),businessId=String(input.businessId??"").trim(),name=String(input.name??"").trim();
  const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(!tenantId||!businessId||!name)return out({error:"TENANT_BUSINESS_NAME_REQUIRED"},400);
  if(!uuidPattern.test(tenantId)||!uuidPattern.test(businessId))return out({error:"INVALID_TENANT_OR_BUSINESS_ID"},400);
  if((input.phone!=null&&typeof input.phone!=="string")||(input.address!=null&&typeof input.address!=="string"))return out({error:"INVALID_REQUEST_FIELDS"},400);
  const phone=input.phone==null?"":input.phone.trim(),address=input.address==null?"":input.address.trim();
  const coordinates=parseBranchCoordinates(input.latitude,input.longitude);
  const {latitude,longitude}=coordinates;
  if(name.length>200||phone.length>64||address.length>500)return out({error:"FIELD_TOO_LONG"},400);
  if(coordinates.error)return out({error:coordinates.error},400);
  const {data:membership,error:me}=await db.from("user_memberships").select("id,role,business_id,status,permissions").eq("user_id",user.id).eq("tenant_id",tenantId).eq("status","ACTIVE").or(`business_id.eq.${businessId},business_id.is.null`).order("id").limit(20);
  if(me)return out({error:"MEMBERSHIP_READ_FAILED"},500);
  if(!isBranchCreationAuthorized(membership||[],businessId))return out({error:"BUSINESS_MANAGEMENT_REQUIRED"},403);
  const {data:business,error:be}=await db.from("businesses").select("id,status,organization_id").eq("id",businessId).eq("tenant_id",tenantId).single();
  if(be||!business)return out({error:"BUSINESS_NOT_FOUND"},404);
  if(String(business.status).toUpperCase()!=="ACTIVE")return out({error:"BUSINESS_NOT_ACTIVE"},409);
  const branchId=crypto.randomUUID(), branchCode=code(name);
  const {data:branch,error:ie}=await db.from("branches").insert({
    id:branchId,tenant_id:tenantId,organization_id:business.organization_id??null,business_id:businessId,
    name,code:branchCode,status:"ACTIVE",phone:phone||null,address:address||null,
    latitude,longitude,
    settings:{source:"MNTY_PROVIDER_ONBOARDING"}
  }).select("id,tenant_id,organization_id,business_id,name,code,status,phone,address,latitude,longitude").single();
  if(ie)return out({error:"BRANCH_CREATE_FAILED"},400);
  return out({success:true,branch});
});