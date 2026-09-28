import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const allowedOrigin="https://islamnagy2022-eng.github.io";
const corsHeaders={"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req)=>{
 const origin=req.headers.get("Origin");
 if(req.method==="OPTIONS"){if(origin&&origin!==allowedOrigin)return out({error:"ORIGIN_NOT_ALLOWED"},403);return new Response("ok",{status:200,headers:corsHeaders});}
 if(origin&&origin!==allowedOrigin)return out({error:"ORIGIN_NOT_ALLOWED"},403);
 if(req.method!=="POST")return out({error:"METHOD_NOT_ALLOWED"},405);
 const h=req.headers.get("Authorization")??"";
 if(!h.startsWith("Bearer "))return out({error:"AUTH_REQUIRED"},401);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return out({error:"SERVER_MISCONFIGURED"},500);
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:auth,error:authError}=await admin.auth.getUser(h.slice(7).trim());
 if(authError||!auth.user||auth.user.is_anonymous)return out({error:"UNAUTHORIZED"},401);
 let body:any;try{body=await req.json()}catch{return out({error:"INVALID_JSON"},400)}
 if(!body.tenantId||!body.entry||!Array.isArray(body.lines))return out({error:"MISSING_FIELD"},400);
 const entry={...body.entry,tenant_id:String(body.tenantId)};
 const {data:result,error}=await admin.rpc("post_financial_journal_backend",{p_user_id:auth.user.id,p_entry:entry,p_lines:body.lines});
 if(error)return out({error:error.message||"JOURNAL_POST_FAILED"},400);
 return out(result);
});