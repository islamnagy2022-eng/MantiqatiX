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
    const {error:adminError}=await db.rpc("legal_assert_admin_backend",{p_actor_user_id:user.id});
    if(adminError)return json({error:"LEGAL_ADMIN_REQUIRED"},403);
    const b=await req.json();
    const action=String(b.action??"").toLowerCase();
    if(action==="create_document"){
      const {data,error}=await db.rpc("legal_create_document_backend",{
        p_actor_user_id:user.id,
        p_document_type:String(b.documentType??""),
        p_title:String(b.title??""),
        p_target_audience:Array.isArray(b.targetAudience)?b.targetAudience:["ALL"],
        p_required_consent:Boolean(b.requiredConsent),
        p_requires_reconsent:Boolean(b.requiresReconsent),
        p_sector_codes:Array.isArray(b.sectorCodes)?b.sectorCodes:[],
        p_locale:String(b.locale??"ar-EG")
      });
      if(error)throw error;
      return json({success:true,data});
    }
    if(action==="update_document"){
      const {data,error}=await db.rpc("legal_update_document",{p_actor_user_id:user.id,p_document_id:String(b.documentId??""),p_title:String(b.title??""),p_target_audience:Array.isArray(b.targetAudience)?b.targetAudience.map((x:string)=>x.toUpperCase()):["ALL"],p_required_consent:Boolean(b.requiredConsent),p_requires_reconsent:Boolean(b.requiresReconsent),p_sector_codes:Array.isArray(b.sectorCodes)?b.sectorCodes:[],p_locale:String(b.locale??"ar-EG")});
      if(error)throw error;
      return json({success:true,data});
    }
    if(action==="create_version"){
      const {data,error}=await db.rpc("legal_create_draft_version_backend",{
        p_actor_user_id:user.id,
        p_document_id:String(b.documentId??""),
        p_version_number:Number(b.versionNumber),
        p_content:String(b.content??"")
      });
      if(error)throw error;
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