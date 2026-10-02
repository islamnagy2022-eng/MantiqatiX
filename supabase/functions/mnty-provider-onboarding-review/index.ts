import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const corsHeaders = {"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};

Deno.serve(async (req) => {
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  if((req.headers.get("Origin")||allowedOrigin)!==allowedOrigin)return json({error:"origin_not_allowed"},403);
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return json({error:"missing_authorization"},401);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return json({error:"server_configuration_error"},500);
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data.user||data.user.is_anonymous)return json({error:"unauthorized"},401);
  let b;try{b=await req.json()}catch{return json({error:"invalid_json"},400)}
  if(!b?.onboarding_request_id||!["APPROVED","REJECTED"].includes(b?.decision))return json({error:"onboarding_request_id_and_decision_required"},400);
  const {data:result,error:rpcError}=await admin.schema("private").rpc("review_provider_onboarding_atomic",{
    p_actor_user_id:data.user.id,
    p_onboarding_request_id:String(b.onboarding_request_id),
    p_decision:String(b.decision),
    p_rejection_reason:b.rejection_reason?String(b.rejection_reason).trim().slice(0,1000):null
  });
  if(rpcError){
    const m=rpcError.message||"";
    const status=/admin_required|platform_admin/.test(m)?403:/not_found|invalid_decision|required/.test(m)?400:/not_pending|already_exists/.test(m)?409:500;
    return json({error:m||"onboarding_review_failed"},status);
  }
  return json({ok:true,...(result||{})});
});
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
