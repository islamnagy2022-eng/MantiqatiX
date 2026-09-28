import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const headers = {
  "Content-Type":"application/json",
  "Access-Control-Allow-Origin":allowedOrigin,
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Vary":"Origin",
};
const json=(b:Record<string,unknown>,s=200)=>new Response(JSON.stringify(b),{status:s,headers});

Deno.serve(async req=>{
  const origin=req.headers.get("Origin");
  if(req.method==="OPTIONS"){
    if(origin && origin!==allowedOrigin) return json({error:"ORIGIN_NOT_ALLOWED"},403);
    return new Response("ok",{status:200,headers});
  }
  if(origin && origin!==allowedOrigin) return json({error:"ORIGIN_NOT_ALLOWED"},403);
  if(req.method!=="POST") return json({error:"METHOD_NOT_ALLOWED"},405);

  try{
    const auth=req.headers.get("Authorization");
    if(!auth?.startsWith("Bearer ")) return json({error:"AUTH_REQUIRED"},401);
    const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!key) return json({error:"SERVER_MISCONFIGURED"},500);
    const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:{user},error:ae}=await db.auth.getUser(auth.slice(7).trim());
    if(ae||!user||user.is_anonymous) return json({error:"AUTH_REQUIRED"},401);

    const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
    if(!body) return json({error:"INVALID_JSON"},400);
    const approvalId=String(body.approvalRequestId??"").trim();
    const action=String(body.action??"").trim().toUpperCase();
    if(!approvalId||!["APPROVE","REJECT"].includes(action)) return json({error:"INVALID_REQUEST"},400);

    const {data:result,error}=await db.schema("private").rpc("review_business_approval_atomic",{
      p_actor_user_id:user.id,
      p_approval_request_id:approvalId,
      p_action:action
    });
    if(error){
      const m=error.message||"";
      const status=/required|invalid_action|unsupported_approval|business_not_found/.test(m)?400:
        /approval_not_found/.test(m)?404:
        /approval_already_resolved/.test(m)?409:
        /forbidden/.test(m)?403:500;
      return json({error:m||"APPROVAL_FAILED"},status);
    }
    return json(result??{success:true});
  }catch(e){
    return json({error:e instanceof Error?e.message:"APPROVAL_FAILED"},400);
  }
});
