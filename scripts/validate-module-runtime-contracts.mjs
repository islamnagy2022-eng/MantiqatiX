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
 ["MARKETING","operations",["marketing_leads","marketing_provider_profiles","marketing_services","marketing_projects"]],
 ["BUSINESS_ERP","operations",["businesses","erp_purchase_orders","erp_purchase_receipts","erp_stock_transfers","warehouses"]],
 ["ACCOUNTING","operations",["chart_of_accounts","journal_entries","general_ledger"]],
 ["LEGAL","operations",["legal_documents","legal_requirements","agreements"]],
 ["PARTNERS","app",["success_partners","referred_businesses"]],
 ["ADS","app",["advertisements","ad_campaigns"]],
 ["TRAVEL","operations",["travel_packages","travel_bookings"]],
 ["USED_ITEMS","operations",["used_item_ads"]],
 ["PHYSIOTHERAPY","operations",["medical_appointments","patient_records"]],
 ["PHARMACIES","operations",["pharmacy_profiles","pharmacy_offers","orders"]],
 ["CLINICS","operations",["doctor_profiles","medical_appointments","clinic_offers"]],
 ["HOSPITALS","operations",["hospital_profiles","medical_appointments"]],
 ["LABS","operations",["lab_profiles","lab_tests","medical_appointments"]],
 ["ACCOUNTING_SERVICES","reverse",["indrive_requests","indrive_bids"]],
 ["COMPANIES","reverse",["indrive_requests","indrive_bids"]],
 ["FACTORIES","reverse",["indrive_requests","indrive_bids"]],
 ["FLIGHTS_TRIPS","reverse",["indrive_requests","indrive_bids"]],
 ["HOME_MAINTENANCE","reverse",["indrive_requests","indrive_bids"]],
 ["SOFTWARE_ERP","reverse",["indrive_requests","indrive_bids"]]
];
const failures=[];
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
