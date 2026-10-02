import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 try{
  const auth=req.headers.get("Authorization"); if(!auth?.startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:{user},error:authError}=await admin.auth.getUser(auth.slice(7));
  if(authError||!user||user.is_anonymous)return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json(),entry=body.entry,lines=body.lines;
  if(!entry||typeof entry!=="object"||!Array.isArray(lines)||lines.length===0)return json({error:"JOURNAL_ENTRY_AND_LINES_REQUIRED"},400);
  if(!String(entry.tenant_id??""))return json({error:"TENANT_REQUIRED"},400);
  if(String(entry.status??"")!=="POSTED")return json({error:"ONLY_POSTED_JOURNALS_SUPPORTED"},400);
  const {data,error}=await admin.rpc("post_financial_journal",{p_entry:entry,p_lines:lines});
  if(error)throw error;
  return json({success:true,journal:data});
 }catch(e){return json({error:e instanceof Error?e.message:"FINANCIAL_JOURNAL_FAILED"},400)}
});