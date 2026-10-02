import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers});
function asUuid(value:unknown,field:string):string{const text=String(value??"").trim();if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text))throw new Error(`${field}_INVALID`);return text;}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 try{
  const authorization=req.headers.get("Authorization"); if(!authorization?.startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:{user},error:authError}=await admin.auth.getUser(authorization.slice(7));
  if(authError||!user||user.is_anonymous)return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json();
  const tenantId=asUuid(body.tenantId,"TENANT_ID"),businessId=asUuid(body.businessId,"BUSINESS_ID"),branchId=body.branchId?asUuid(body.branchId,"BRANCH_ID"):null,id=asUuid(body.id,"PRODUCT_ID");
  const name=String(body.name??"").trim(),sku=String(body.sku??"").trim(),barcode=body.barcode?String(body.barcode).trim():null,category=String(body.category??"").trim(),unit=String(body.unit??"PCS").trim().toUpperCase();
  const costPrice=Number(body.costPrice??0),sellingPrice=Number(body.sellingPrice??0),taxRate=Number(body.taxRate??0),stockQty=Number(body.stockQty??0);
  if(!name||!sku)return json({error:"NAME_AND_SKU_REQUIRED"},400);
  if(category.length>128)return json({error:"CATEGORY_TOO_LONG"},400);
  if(name.length>255||sku.length>128||(barcode&&barcode.length>128))return json({error:"FIELD_TOO_LONG"},400);
  if(!Number.isFinite(costPrice)||costPrice<0||!Number.isFinite(sellingPrice)||sellingPrice<0||!Number.isFinite(taxRate)||taxRate<0)return json({error:"INVALID_PRODUCT_NUMBERS"},400);
  if(!Number.isFinite(stockQty)||stockQty!==0)return json({error:"OPENING_STOCK_REQUIRES_WAREHOUSE_FLOW"},400);
  const {data:membershipRows,error:membershipError}=await admin.from("user_memberships").select("role,business_id,branch_id,status").eq("user_id",user.id).eq("tenant_id",tenantId).eq("status","ACTIVE");
  if(membershipError)throw membershipError;
  const allowedRoles=new Set(["OWNER","BUSINESS_OWNER","ADMIN","MANAGER","EMPLOYEE","STAFF"]);
  const allowed=(membershipRows??[]).some((m:any)=>allowedRoles.has(String(m.role).toUpperCase())&&String(m.business_id??"")===businessId&&(!branchId||!m.branch_id||String(m.branch_id)===branchId));
  if(!allowed)return json({error:"FORBIDDEN"},403);
  const {data:business,error:businessError}=await admin.from("businesses").select("id,tenant_id").eq("id",businessId).eq("tenant_id",tenantId).is("deleted_at",null).maybeSingle();
  if(businessError)throw businessError;if(!business)return json({error:"BUSINESS_SCOPE_INVALID"},403);
  if(branchId){const {data:branch,error:branchError}=await admin.from("branches").select("id,business_id,tenant_id").eq("id",branchId).eq("business_id",businessId).eq("tenant_id",tenantId).maybeSingle();if(branchError)throw branchError;if(!branch)return json({error:"BRANCH_SCOPE_INVALID"},400);}
  const {data:existingSku,error:skuError}=await admin.from("products").select("id").eq("business_id",businessId).eq("sku",sku).maybeSingle();
  if(skuError)throw skuError;if(existingSku)return json({error:"SKU_ALREADY_EXISTS"},409);
  const {data:product,error:insertError}=await admin.from("products").insert({id,tenant_id:tenantId,business_id:businessId,branch_id:branchId,sku,barcode,name,unit,cost_price:costPrice,selling_price:sellingPrice,tax_rate:taxRate,status:"ACTIVE",attributes:category?{legacy_category:category}:{} }).select("id,tenant_id,business_id,branch_id,name,sku,barcode,unit,cost_price,selling_price,tax_rate,status").single();
  if(insertError)throw insertError;
  return json({success:true,product});
 }catch(error){return json({error:error instanceof Error?error.message:"ERP_PRODUCT_CREATE_FAILED"},400);}
});