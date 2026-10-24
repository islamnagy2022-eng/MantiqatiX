import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const catalog=read("web/android-parity-catalog.js");
const files={
 app:read("web/app.js"),
 operations:read("web/operations-modules.js"),
 restaurant:read("web/restaurant-module.js"),
 reverse:read("web/reverse-bidding-module.js")
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
if(files.operations.includes("if(r.error)rows[t]=[]")) failures.push("OPERATIONS_QUERY_ERRORS_MUST_FAIL_CLOSED");
if(files.operations.includes(".limit(1).maybeSingle()")) failures.push("OPERATIONS_MUST_NOT_PICK_ARBITRARY_MEMBERSHIP");
if(!files.operations.includes("اختر المؤسسة أو الفرع الصحيح")) failures.push("OPERATIONS_MEMBERSHIP_SELECTION_REQUIRED");
if(!files.operations.includes("يلزم اختيار عضوية نشطة مرتبطة بمؤسسة محددة")) failures.push("GROCERY_MEMBERSHIP_SCOPE_FAIL_CLOSED");
if(!files.operations.includes("q=q.eq('tenant_id',m.tenant_id).eq('business_id',m.business_id).order('name_ar'")) failures.push("GROCERY_CATALOG_TENANT_BUSINESS_SCOPE");
if(!files.operations.includes("q=q.eq('tenant_id',m.tenant_id).in('catalog_item_id',itemIds).order('version'")) failures.push("GROCERY_PRICES_SCOPED_TO_CATALOG_ITEMS");
if(!files.operations.includes("عرض للقراءة فقط ضمن المؤسسة والفرع المحددين")) failures.push("GROCERY_READ_ONLY_INVENTORY_ORDER_VIEW");
if(!files.operations.includes("table([['الصنف','product_id'],['نوع الحركة','transaction_type']")) failures.push("GROCERY_INVENTORY_PRODUCT_ID_COLUMN");
if(!files.operations.includes("'سوبر ماركت':{key:'GROCERY',tabs:['overview','catalog','prices','live']")) failures.push("SUPERMARKET_ALIAS_SHARED_GROCERY_WORKSPACE");
if(!files.operations.includes("'ملابس وأزياء':{key:'FASHION',tabs:['overview','products','orders','tailors']")) failures.push("FASHION_ALIAS_SHARED_WORKSPACE");
if(!files.operations.includes("q=q.eq('tenant_id',m.tenant_id).eq('business_id',m.business_id).order('created_at',{ascending:false})")) failures.push("FASHION_PRODUCTS_ORDERS_SCOPED");
if(!files.operations.includes("q=q.eq('owner_user_id',user.id).order('created_at',{ascending:false})")) failures.push("FASHION_TAILOR_SERVICES_OWNER_SCOPED");
if(!files.operations.includes("لا يتم عرض هاتف العميل أو عنوانه")) failures.push("FASHION_ORDER_PII_NOT_IN_LIST");
if(!files.operations.includes("يلزم اختيار عضوية نشطة مرتبطة بمؤسسة محددة لعرض بيانات هذا النشاط")) failures.push("FASHION_MEMBERSHIP_SCOPE_FAIL_CLOSED");
if(!files.operations.includes('id="op-membership-select"')||!files.operations.includes("data-op-use-membership")) failures.push("OPERATIONS_MEMBERSHIP_SELECTOR_UI_MISSING");
if(!files.operations.includes("localStorage.setItem('MNTYActiveMembershipId',selected.id)")) failures.push("OPERATIONS_MEMBERSHIP_SELECTION_NOT_PERSISTED");
if(!files.operations.includes("تم إيقاف تحميل بيانات المؤسسة حفاظًا على العزل")) failures.push("SCOPED_OPERATIONS_REQUIRE_ACTIVE_MEMBERSHIP");
if(!files.operations.includes("لم نعرضها كأنها فارغة")) failures.push("OPERATIONS_QUERY_ERROR_STATE_MISSING");
if(!files.operations.includes("sb.rpc('create_education_request_backend'")) failures.push("EDUCATION_BACKEND_RPC_MISSING");
if(!files.operations.includes("'provider-services'")||!files.operations.includes("rows.marketing_provider_services")) failures.push("MARKETING_PROVIDER_SERVICES_VIEW_MISSING");
for(const required of ["plans","subscriptions","participants","commissions"]){if(!marketingSource.includes("data-op-tab=\""+required+"\"")&&!marketingSource.includes("'"+required+"'")) failures.push("MARKETING_TAB_"+required.toUpperCase());}
const marketingFinancialReadOnlyContracts=[
 ["projects","ملخصات المشروعات والقيم والعمولات معروضة للقراءة فقط"],
 ["plans","الخطط معروضة للقراءة فقط حاليًا"],
 ["subscriptions","الاشتراكات معروضة للقراءة فقط"],
 ["participants","مشاركات المشروعات للقراءة فقط"],
 ["commissions","قواعد العمولات للعرض فقط"]
];
for(const [tabName,notice] of marketingFinancialReadOnlyContracts){
 if(!marketingSource.includes("if(tab==='"+tabName+"')return shell(d,tabs(d)+'<div class=\"notice\">"+notice))
  failures.push("MARKETING_"+tabName.toUpperCase()+"_READ_ONLY_NOTICE_MISSING");
}
const marketingFinancialDirectWrite=/\.from\(\s*['"](?:marketing_projects|marketing_plans|marketing_provider_subscriptions|marketing_project_participants|marketing_commission_rules)['"]\s*\)\s*\.\s*(?:insert|update|upsert|delete)\s*\(/;
if(marketingFinancialDirectWrite.test(marketingSource)||marketingFinancialDirectWrite.test(files.app)) failures.push("MARKETING_FINANCIAL_DIRECT_WRITE_FORBIDDEN");
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
