import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const allowedOrigin="https://islamnagy2022-eng.github.io";
const corsHeaders={"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return json({error:"method_not_allowed"},405);
 if((req.headers.get("Origin")||allowedOrigin)!==allowedOrigin) return json({error:"origin_not_allowed"},403);
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return json({error:"missing_authorization"},401);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return json({error:"server_configuration_error"},500);
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:ad,error:ae}=await admin.auth.getUser(token),user=ad?.user;
 if(ae||!user||user.is_anonymous)return json({error:"unauthorized"},401);
 let b;try{b=await req.json()}catch{return json({error:"invalid_json"},400)}
 const rid=String(b?.registration_request_id||"").trim(),tenant=String(b?.tenant_id||"").trim(),org=String(b?.organization_id||"").trim();
 const name=String(b?.business_name||"").trim().slice(0,180),kind=String(b?.provider_kind||"").trim().slice(0,80);
 if(!rid||tenant!=="MNTY-PLATFORM"||org!=="MNTY-MAIN"||name.length<2||kind.length<2)return json({error:"required_fields_missing"},400);
 const arr=(v,max=30)=>Array.isArray(v)?v.map(x=>String(x??"").trim()).filter(Boolean).slice(0,max):[];
 const rawAreas=Array.isArray(b?.service_areas)?b.service_areas.slice(0,10):[];
 if(rawAreas.length!==1)return json({error:"service_area_required"},400);
 const area=rawAreas[0];
 const areaFields=["governorate_id","governorate_code","governorate_name_ar","center_id","center_code","center_name_ar"];
 if(!area||typeof area!=="object"||areaFields.some(k=>!String(area[k]||"").trim()))return json({error:"governorate_and_center_required"},400);
 const {data:gov,error:govErr}=await admin.from("platform_geo_areas").select("id,code,name_ar,name_en").eq("id",String(area.governorate_id)).eq("country_code","EG").eq("level","GOVERNORATE").eq("status","ACTIVE").maybeSingle();
 if(govErr)return json({error:"governorate_lookup_failed"},500);
 if(!gov||gov.code!==String(area.governorate_code)||gov.name_ar!==String(area.governorate_name_ar))return json({error:"invalid_governorate"},400);
 const {data:center,error:centerErr}=await admin.from("platform_geo_areas").select("id,code,name_ar,name_en,parent_id").eq("id",String(area.center_id)).eq("country_code","EG").eq("level","MARKAZ").eq("status","ACTIVE").eq("parent_id",gov.id).maybeSingle();
 if(centerErr)return json({error:"center_lookup_failed"},500);
 if(!center||center.code!==String(area.center_code)||center.name_ar!==String(area.center_name_ar))return json({error:"invalid_center"},400);
 const normalizedArea={governorate_id:gov.id,governorate_code:gov.code,governorate_name_ar:gov.name_ar,governorate_name_en:gov.name_en||"",center_id:center.id,center_code:center.code,center_name_ar:center.name_ar,center_name_en:center.name_en||""};
 const {data:reqRow,error:reqErr}=await admin.from("account_registration_requests").select("id,user_id,requested_role,status").eq("id",rid).eq("user_id",user.id).eq("requested_role","SERVICE_PROVIDER").maybeSingle();
 if(reqErr)return json({error:"registration_lookup_failed"},500);
 if(!reqRow)return json({error:"registration_not_found"},400);
 if(reqRow.status!=="PENDING")return json({error:"registration_not_pending"},409);
 const {data:mem,error:memErr}=await admin.from("user_memberships").select("id").eq("user_id",user.id).eq("tenant_id",tenant).eq("status","ACTIVE").eq("role","CUSTOMER").limit(1).maybeSingle();
 if(memErr)return json({error:"membership_lookup_failed"},500);
 if(!mem)return json({error:"customer_membership_required"},400);
 const {data:ex,error:exErr}=await admin.from("provider_onboarding_requests").select("id,status").eq("registration_request_id",rid).maybeSingle();
 if(exErr)return json({error:"onboarding_lookup_failed"},500);
 if(ex?.status==="PENDING")return json({error:"onboarding_already_exists"},409);
 if(ex&&["APPROVED","REJECTED"].includes(ex.status))return json({error:"onboarding_already_processed"},409);
 const {data:created,error:ce}=await admin.from("provider_onboarding_requests").insert({registration_request_id:rid,user_id:user.id,tenant_id:tenant,organization_id:org,business_name:name,provider_kind:kind,name_en:b?.name_en?String(b.name_en).trim().slice(0,180):null,description:b?.description?String(b.description).trim().slice(0,3000):null,specialties:arr(b?.specialties),service_areas:[normalizedArea],portfolio:arr(b?.portfolio,20),profile_image_path:b?.profile_image_path?String(b.profile_image_path).trim().slice(0,500):null,status:"PENDING"}).select("id,status").single();
 if(ce){if(ce.code==="23505")return json({error:"onboarding_already_exists"},409);return json({error:"onboarding_submit_failed"},500)}
 const {error:me}=await admin.from("account_registration_requests").update({metadata:{source:"provider_onboarding",onboarding_request_id:created.id},updated_at:new Date().toISOString()}).eq("id",rid).eq("user_id",user.id);
 if(me){await admin.from("provider_onboarding_requests").delete().eq("id",created.id);return json({error:"registration_metadata_update_failed"},500)}
 return json({ok:true,onboarding_request_id:created.id,status:"PENDING"});
});
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
