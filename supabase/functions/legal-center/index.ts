import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(b:Record<string,unknown>,s=200)=>new Response(JSON.stringify(b),{status:s,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 try{
  const a=req.headers.get("Authorization");
  if(!a?.startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401);
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:{user},error:ue}=await db.auth.getUser(a.slice(7));
  if(ue||!user||user.is_anonymous)return json({error:"AUTH_REQUIRED"},401);
  const b=await req.json();
  const accountType=String(b.accountType??"CUSTOMER").toUpperCase();
  const {data:docs,error:de}=await db.from("legal_documents").select("id,document_type,title,status,published_at,effective_at,target_audience,required_consent,requires_reconsent,sector_codes,locale").eq("status","PUBLISHED");
  if(de)throw de;
  const {data:vers,error:ve}=await db.from("legal_document_versions").select("id,document_id,version_number,published_at,effective_at,content_hash,content").eq("status","PUBLISHED").lte("effective_at",new Date().toISOString()).order("version_number",{ascending:false});
  if(ve)throw ve;
  const {data:reqs,error:re}=await db.from("legal_requirements").select("action_key,document_type,target_audience,required,enabled,business_scoped").eq("enabled",true).eq("required",true);
  if(re)throw re;
  const {data:cons,error:ce}=await db.from("user_consents").select("id,document_id,document_version_id,agreement_id,account_type,consent_status,consented_at,content_hash,source").eq("user_id",user.id);
  if(ce)throw ce;
  const visible=(docs??[]).filter((d:any)=>d.target_audience?.includes("ALL")||d.target_audience?.includes(accountType));
  const latest=(id:string)=>(vers??[]).find((v:any)=>v.document_id===id);
  const pending=(reqs??[]).map((r:any)=>{const d=visible.find((x:any)=>x.document_type===r.document_type);const v=d?latest(d.id):null;const accepted=Boolean(d&&v&&(cons??[]).some((c:any)=>c.document_id===d.id&&c.document_version_id===v.id&&c.consent_status==="ACCEPTED"&&c.content_hash===v.content_hash));return {...r,document:d,version:v,accepted};}).filter((x:any)=>x.document&&x.version);
  return json({success:true,documents:visible,versions:vers??[],consents:cons??[],pending});
 }catch(e){return json({error:e instanceof Error?e.message:"LEGAL_CENTER_FAILED"},400);}
});