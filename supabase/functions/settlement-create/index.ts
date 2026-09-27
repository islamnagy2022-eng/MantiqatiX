import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const corsHeaders = {"Access-Control-Allow-Origin": allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Content-Type":"application/json"};
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS"){const origin=req.headers.get("Origin");if(origin&&origin!==allowedOrigin)return json({error:"origin_not_allowed"},403);return new Response("ok",{status:200,headers:corsHeaders});}
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  const origin=req.headers.get("Origin");if(origin&&origin!==allowedOrigin)return json({error:"origin_not_allowed"},403);
  try{
    const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401);
    const url=Deno.env.get("SUPABASE_URL"), serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if(!url||!serviceRoleKey||!anonKey)return json({error:"SERVER_MISCONFIGURED"},500);
    const admin=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const userClient=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:auth}}});
    const {data:{user},error:authError}=await admin.auth.getUser(auth.slice(7).trim());
    if(authError||!user||user.is_anonymous)return json({error:"AUTH_REQUIRED"},401);
    const body=await req.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return json({error:"INVALID_JSON"},400);
    const required=["id","tenantId","beneficiaryType","beneficiaryId","gross","platformFee","net","voucher","channel"];
    for(const key of required)if(body[key]===undefined||body[key]===null||String(body[key]).trim()==="")return json({error:"MISSING_FIELD",field:key},400);
    const {data,error}=await userClient.rpc("create_settlement_backend",{
      p_id:String(body.id),p_tenant_id:String(body.tenantId),p_beneficiary_type:String(body.beneficiaryType),p_beneficiary_id:String(body.beneficiaryId),
      p_gross:Number(body.gross),p_platform_fee:Number(body.platformFee),p_net:Number(body.net),p_voucher:Number(body.voucher),
      p_channel:String(body.channel),p_reference_id:body.referenceId?String(body.referenceId):null
    });
    if(error){console.error(JSON.stringify({stage:"create_settlement_backend",code:error.code}));return json({error:"SETTLEMENT_FAILED"},400);}
    return json({success:true,settlement:data});
  }catch(error){console.error(JSON.stringify({stage:"unhandled",error:error instanceof Error?error.message:"UNKNOWN"}));return json({error:"SETTLEMENT_FAILED"},400);}
});