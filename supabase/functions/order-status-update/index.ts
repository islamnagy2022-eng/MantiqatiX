import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST") return out({error:"METHOD_NOT_ALLOWED"},405);
 const h=req.headers.get("Authorization")??"";
 if(!h.startsWith("Bearer ")) return out({error:"AUTH_REQUIRED"},401);
 const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key) return out({error:"SERVER_MISCONFIGURED"},500);
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await admin.auth.getUser(h.slice(7).trim());
 if(error||!data.user||data.user.is_anonymous) return out({error:"UNAUTHORIZED"},401);
 let body:any; try{body=await req.json()}catch{return out({error:"INVALID_JSON"},400)}
 if(!body.orderId||!body.tenantId||!body.newStatus) return out({error:"MISSING_FIELD"},400);
 const {data:result,error:rpcError}=await admin.rpc("update_order_status_backend",{
   p_order_id:body.orderId,p_tenant_id:body.tenantId,p_user_id:data.user.id,
   p_new_status:body.newStatus,p_reason:body.reason??null
 });
 if(rpcError) return out({error:rpcError.message||"ORDER_STATUS_UPDATE_FAILED"},400);
 return out(result);
});