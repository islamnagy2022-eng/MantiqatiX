import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"https://islamnagy2022-eng.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Vary":"Origin"};
function response(body:Record<string,unknown>,status=200){return new Response(JSON.stringify(body),{status,headers});}
function safeCode(name:string){const slug=name.trim().toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,24)||"BUSINESS";return slug+"-"+crypto.randomUUID().slice(0,8).toUpperCase();}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return response({error:"METHOD_NOT_ALLOWED"},405);
 try{
  const authorization=req.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer "))return response({error:"AUTH_REQUIRED"},401);
  const token=authorization.slice(7);
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:{user},error:authError}=await supabase.auth.getUser(token);
  if(authError||!user||user.is_anonymous)return response({error:"AUTH_REQUIRED"},401);
  const body=await req.json();
  const tenantId=String(body.tenantId??"").trim(),name=String(body.name??"").trim(),sector=String(body.sector??"GENERAL").trim().toUpperCase();
  const address=String(body.address??"").trim(),phone=String(body.phone??"").trim(),city=String(body.city??"").trim(),district=String(body.district??"").trim();
  const organizationId=body.organizationId?String(body.organizationId):null;
  if(!tenantId||!name)return response({error:"TENANT_AND_NAME_REQUIRED"},400);
  if(name.length>200||phone.length>64||address.length>500||city.length>120||district.length>120||sector.length>80)return response({error:"FIELD_TOO_LONG"},400);
  const {data:memberships,error:membershipError}=await supabase.from("user_memberships").select("id,role,business_id,organization_id,permissions").eq("user_id",user.id).eq("tenant_id",tenantId).eq("status","ACTIVE").limit(20);
  if(membershipError)throw membershipError;
  const allowedRoles=new Set(["SERVICE_PROVIDER","BUSINESS_OWNER","OWNER","ADMIN"]);
  const membership=(memberships||[]).find((m)=>allowedRoles.has(String(m.role||"").toUpperCase()));
  const superAdmin=(memberships||[]).find((m)=>String(m.role||"").toUpperCase()==="SUPER_ADMIN"&&m.business_id==null&&m.permissions?.scope==="PLATFORM"&&m.permissions?.full_control===true);
  if(!membership&&!superAdmin)return response({error:"BUSINESS_CREATE_ROLE_REQUIRED"},403);
  const {data:existing}=await supabase.from("approval_requests").select("id,business_id,status").eq("tenant_id",tenantId).eq("requested_by",user.id).eq("entity_type","BUSINESS").eq("request_type","CREATE").eq("status","PENDING").limit(1);
  if(existing?.length)return response({error:"PENDING_BUSINESS_REQUEST_EXISTS",businessId:existing[0].business_id??null},409);
  const code=safeCode(name),resolvedOrganizationId=organizationId||membership?.organization_id||null;
  const {data:business,error}=await supabase.from("businesses").insert({tenant_id:tenantId,organization_id:resolvedOrganizationId,name,code,status:"INACTIVE",settings:{sector,address,phone,city,district,registration_source:"web",approval_status:"PENDING"}}).select("id,name,code,status,tenant_id,organization_id").single();
  if(error)throw error;
  const requestId="APR-"+crypto.randomUUID();
  const {error:approvalError}=await supabase.from("approval_requests").insert({id:requestId,tenant_id:tenantId,organization_id:resolvedOrganizationId,business_id:business.id,request_type:"CREATE",entity_type:"BUSINESS",entity_id:business.id,requested_by:user.id,status:"PENDING",priority:"NORMAL",reason:"طلب تسجيل نشاط جديد من الويب",metadata:{sector,address,phone,city,district,created_by_super_admin:!!superAdmin}});
  if(approvalError){await supabase.from("businesses").delete().eq("id",business.id);throw approvalError;}
  return response({success:true,business,approvalRequestId:requestId,pendingApproval:true});
 }catch(error){return response({error:error instanceof Error?error.message:"BUSINESS_REGISTER_FAILED"},400);}
});