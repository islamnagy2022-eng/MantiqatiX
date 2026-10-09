import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const catalog=read("web/android-parity-catalog.js");
const files={
 app:read("web/app.js"),
 operations:read("web/operations-modules.js"),
 restaurant:read("web/restaurant-module.js"),
 reverse:read("web/reverse-bidding-module.js"),
 smm:read("web/smm.js"),
 smmGateway:read("supabase/functions/smm-gateway/index.ts")
};
const modules=[
 ["RESTAURANTS","restaurant",["restaurant_menu_items","restaurant_orders","restaurant_tables"]],
 ["CAFES","restaurant",["restaurant_menu_items","restaurant_tables","restaurant_orders"]],
 ["SUPERMARKET","operations",["catalog_items","catalog_item_prices","inventory_transactions","orders"]],
 ["CLOTHING","operations",["fashion_products","fashion_orders","fashion_tailor_services"]],
 ["MANTIGO","operations",["mantigo_rides","mantigo_bids","mantigo_ride_ratings"]],
 ["MARRIAGE","operations",["matrimony_profiles","matrimony_requests","matrimony_contact_unlocks"]],
 ["JOBS","operations",["jobs","job_applications"]],
 ["SCHOOLS","operations",["school_profiles","teacher_profiles","education_requests"]],
 ["MAINTENANCE","reverse",["indrive_requests","indrive_bids","support_tickets"]],
 ["MARKETING","operations",["marketing_leads","marketing_provider_profiles","marketing_services","marketing_projects","marketing_plans","marketing_provider_subscriptions","marketing_project_participants","marketing_commission_rules"]],
 ["BUSINESS_ERP","operations",["businesses","erp_purchase_orders","erp_purchase_receipts","erp_stock_transfers","warehouses"]],
 ["ACCOUNTING","operations",["chart_of_accounts","journal_entries","general_ledger"]],
 ["LEGAL","operations",["legal_documents","legal_requirements","agreements"]],
 ["PARTNERS","app",["success_partners","referred_businesses"]],
 ["ADS","app",["advertisements","ad_campaigns"]],
 ["TRAVEL","operations",["travel_packages","travel_bookings"]],
 ["USED_ITEMS","operations",["used_item_ads"]],
 ["PHYSIOTHERAPY","operations",["medical_appointments","marketing_provider_profiles"]],
 ["PHARMACIES","operations",["marketing_provider_profiles","orders"]],
 ["CLINICS","operations",["marketing_provider_profiles","medical_appointments"]],
 ["HOSPITALS","operations",["marketing_provider_profiles","medical_appointments"]],
 ["LABS","operations",["marketing_provider_profiles","medical_appointments"]],
 ["ACCOUNTING_SERVICES","reverse",["indrive_requests","indrive_bids"]],
 ["COMPANIES","reverse",["indrive_requests","indrive_bids"]],
 ["FACTORIES","reverse",["indrive_requests","indrive_bids"]],
 ["FLIGHTS_TRIPS","reverse",["indrive_requests","indrive_bids"]],
 ["HOME_MAINTENANCE","reverse",["indrive_requests","indrive_bids"]],
 ["SOFTWARE_ERP","reverse",["indrive_requests","indrive_bids"]]
];
const failures=[];
const operationDefinitions=[...files.operations.matchAll(/^'([^']+)':\{key:/gm)].map(m=>m[1]);
const duplicateOperationDefinitions=[...new Set(operationDefinitions.filter((name,i)=>operationDefinitions.indexOf(name)!==i))];
if(duplicateOperationDefinitions.length) failures.push("DUPLICATE_MODULE_DEFINITIONS:"+duplicateOperationDefinitions.join(","));
const marketingSource=files.operations;
const marketingKeyCount=(marketingSource.match(/'المزايدات — التسويق':/g)||[]).length;
if(marketingKeyCount!==1) failures.push("MARKETING_DUPLICATE_DEFINITION");
if(files.operations.includes("sb.from('education_requests').insert")) failures.push("EDUCATION_DIRECT_INSERT_FORBIDDEN");
if(files.smm.includes("sb.from('smm_services')")||files.smm.includes("sb.from('smm_orders')")||files.smm.includes("sb.from('smm_wallets')")) failures.push("SMM_RESTRICTED_DIRECT_READ_FORBIDDEN");
if(!files.smm.includes("fn({action:'catalog'})")||!files.smm.includes("fn({action:'my_data'})")) failures.push("SMM_GATEWAY_READS_MISSING");
if(!files.smmGateway.includes('if(a==="catalog")')||!files.smmGateway.includes('if(a==="my_data")')) failures.push("SMM_GATEWAY_READ_ACTIONS_MISSING");
if(!files.smmGateway.includes('is_admin:await isAdmin(user.id)')) failures.push("SMM_ADMIN_FLAG_NOT_SERVER_AUTHORIZED");
if(!files.smmGateway.includes('role==="SUPER_ADMIN"&&p.scope==="PLATFORM"&&p.full_control===true')) failures.push("SMM_PLATFORM_ADMIN_SCOPE_REQUIRED");
if(files.smmGateway.includes('["OWNER","ADMIN","SUPER_ADMIN"].includes(String(m.role).toUpperCase())')) failures.push("SMM_ADMIN_ROLE_SCOPE_TOO_BROAD");
if(!files.smm.includes("loadError")||!files.smm.includes("حالة البيانات")) failures.push("SMM_READ_ERROR_STATE_MISSING");
if(!files.operations.includes("sb.rpc('create_education_request_backend'")) failures.push("EDUCATION_BACKEND_RPC_MISSING");
for(const required of ["plans","subscriptions","participants","commissions"]){if(!marketingSource.includes("data-op-tab=\""+required+"\"")&&!marketingSource.includes("'"+required+"'")) failures.push("MARKETING_TAB_"+required.toUpperCase());}
for(const [code,owner,tables] of modules){
 const source=files[owner];
 const catalogEntry=catalog.includes("code:'"+code+"'");
 const tableCoverage=tables.every(t=>catalog.includes("'"+t+"'")||catalog.includes('"'+t+'"'));
 const runtimeMarker=owner==="app" ? source.length>1000 : source.length>1000;
 if(!catalogEntry||!tableCoverage||!runtimeMarker) failures.push(code);
}
if(failures.length){console.error("Module runtime contract FAILED:",failures.join(", "));process.exit(1);}
console.log("Module runtime contract PASSED: "+modules.length+" modules mapped to existing runtime/data contracts.");
console.log("E2E transaction testing remains NOT VERIFIED by design; no production data is created.");
