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
    const {data:m,error:me}=await db.from("user_memberships").select("role,status").eq("user_id",user.id).eq("status","ACTIVE").in("role",["SUPER_ADMIN","ADMIN","LEGAL_ADMIN"]).limit(1).maybeSingle();
    if(me)throw me;
    if(!m)return json({error:"LEGAL_ADMIN_REQUIRED"},403);
    const b=await req.json();
    const action=String(b.action??"").toLowerCase();
    const audit=async(eventType:string,documentId:string|null,versionId:string|null,metadata:Record<string,unknown>={})=>{
      const {error}=await db.from("consent_audit_log").insert({actor_user_id:user.id,event_type:eventType,document_id:documentId,document_version_id:versionId,event_at:new Date().toISOString(),metadata});
      if(error) throw error;
    };
    if(action==="create_document"){
      const documentType=String(b.documentType??"").trim().toUpperCase();
      const title=String(b.title??"").trim();
      if(!documentType||!title)return json({error:"LEGAL_DOCUMENT_FIELDS_REQUIRED"},400);
      const {data,error}=await db.from("legal_documents").insert({document_type:documentType,title,target_audience:Array.isArray(b.targetAudience)?b.targetAudience.map((x:string)=>x.toUpperCase()):["ALL"],required_consent:Boolean(b.requiredConsent),requires_reconsent:Boolean(b.requiresReconsent),sector_codes:Array.isArray(b.sectorCodes)?b.sectorCodes:[],locale:b.locale??"ar-EG",status:"DRAFT",created_by:user.id,updated_by:user.id}).select("id,status").single();
      if(error)throw error;
      await audit("LEGAL_DOCUMENT_CREATED",data.id,null,{document_type:documentType,title});
      return json({success:true,data});
    }
    if(action==="update_document"){
      const {data,error}=await db.rpc("legal_update_document",{p_actor_user_id:user.id,p_document_id:String(b.documentId??""),p_title:String(b.title??""),p_target_audience:Array.isArray(b.targetAudience)?b.targetAudience.map((x:string)=>x.toUpperCase()):["ALL"],p_required_consent:Boolean(b.requiredConsent),p_requires_reconsent:Boolean(b.requiresReconsent),p_sector_codes:Array.isArray(b.sectorCodes)?b.sectorCodes:[],p_locale:String(b.locale??"ar-EG")});
      if(error)throw error;
      return json({success:true,data});
    }
    if(action==="create_version"){
      const content=String(b.content??"");
      const versionNumber=Number(b.versionNumber);
      if(!content.trim())return json({error:"LEGAL_CONTENT_REQUIRED"},400);
      if(!Number.isInteger(versionNumber)||versionNumber<1)return json({error:"LEGAL_VERSION_INVALID"},400);
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(content));
      const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
      const {data,error}=await db.from("legal_document_versions").insert({document_id:String(b.documentId),version_number:versionNumber,content,content_hash:hash,status:"DRAFT",created_by:user.id}).select("id,document_id,version_number,status,content_hash").single();
      if(error)throw error;
      await audit("LEGAL_DRAFT_VERSION_CREATED",data.document_id,data.id,{version_number:versionNumber,content_hash:hash});
      return json({success:true,data});
    }
    if(action==="update_draft_version"){
      const content=String(b.content??"");
      if(!content.trim())return json({error:"LEGAL_CONTENT_REQUIRED"},400);
      const {data,error}=await db.rpc("legal_update_draft_version",{p_actor_user_id:user.id,p_version_id:String(b.versionId),p_content:content});
      if(error)throw error;
      return json({success:true,data});
    }
    if(action==="publish"){
      const {data,error}=await db.rpc("legal_publish_version",{p_actor_user_id:user.id,p_document_id:String(b.documentId),p_version_number:Number(b.versionNumber),p_effective_at:b.effectiveAt??new Date().toISOString()});
      if(error)throw error;
      return json({success:true,data});
    }
    if(action==="suspend"){
      const {data,error}=await db.rpc("legal_suspend_document",{p_actor_user_id:user.id,p_document_id:String(b.documentId)});
      if(error)throw error;
      return json({success:true,data});
    }
    return json({error:"UNKNOWN_ACTION"},400);
  }catch(e){return json({error:e instanceof Error?e.message:"LEGAL_CMS_FAILED"},400);}
});