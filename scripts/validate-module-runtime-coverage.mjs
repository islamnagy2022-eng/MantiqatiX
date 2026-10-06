import fs from 'node:fs';
const catalog=fs.readFileSync('web/android-parity-catalog.js','utf8');
const ops=fs.readFileSync('web/operations-modules.js','utf8');
const expected=[["RESTAURANTS",["restaurant_menu_items","restaurant_orders"]],["CAFES",["restaurant_menu_items","restaurant_tables"]],["SUPERMARKET",["catalog_items","orders"]],["CLOTHING",["fashion_products","fashion_orders"]],["MANTIGO",["mantigo_rides","mantigo_bids"]],["MARRIAGE",["matrimony_profiles","matrimony_requests"]],["JOBS",["jobs","job_applications"]],["SCHOOLS",["school_profiles","teacher_profiles","education_requests"]],["MAINTENANCE",["indrive_requests","support_tickets"]],["MARKETING",["marketing_leads","marketing_services"]],["BUSINESS_ERP",["erp_purchase_orders","warehouses"]],["ACCOUNTING",["chart_of_accounts","journal_entries"]],["LEGAL",["legal_documents","agreements"]],["PARTNERS",["success_partners","referred_businesses"]],["ADS",["advertisements","ad_campaigns"]],["TRAVEL",["travel_packages","travel_bookings"]],["USED_ITEMS",["used_item_ads"]],["PHYSIOTHERAPY",["medical_appointments","patient_records"]],["PHARMACIES",["pharmacy_profiles","pharmacy_offers"]],["CLINICS",["doctor_profiles","medical_appointments"]],["HOSPITALS",["hospital_profiles","medical_appointments"]],["LABS",["lab_profiles","lab_tests"]],["ACCOUNTING_SERVICES",["indrive_requests","indrive_bids"]],["COMPANIES",["indrive_requests","indrive_bids"]],["FACTORIES",["indrive_requests","indrive_bids"]],["FLIGHTS_TRIPS",["indrive_requests","indrive_bids"]],["HOME_MAINTENANCE",["indrive_requests","indrive_bids"]],["SOFTWARE_ERP",["indrive_requests","indrive_bids"]]];
const names={"RESTAURANTS":"المطاعم","CAFES":"كافيهات","SUPERMARKET":"سوبر ماركت","CLOTHING":"ملابس وأزياء","MANTIGO":"كابتن","MARRIAGE":"الزواج","JOBS":"الوظائف","SCHOOLS":"مدارس خاصة","MAINTENANCE":"فني صيانة","MARKETING":"المزايدات — التسويق","BUSINESS_ERP":"مدير أعمال","ACCOUNTING":"المزايدات — المحاسبة","LEGAL":"المزايدات — الخدمات القانونية","PARTNERS":"شركاء","ADS":"إعلانات","TRAVEL":"رحلات وسفر","USED_ITEMS":"المستعمل","PHYSIOTHERAPY":"العلاج الطبيعي","PHARMACIES":"الصيدليات","CLINICS":"عيادات الأطباء","HOSPITALS":"المستشفيات الخاصة","LABS":"مراكز التحاليل والأشعة","ACCOUNTING_SERVICES":"الخدمات المحاسبية","COMPANIES":"خدمات الشركات","FACTORIES":"المصانع والخدمات الصناعية","FLIGHTS_TRIPS":"الرحلات والسفر","HOME_MAINTENANCE":"خدمات المنزل والصيانة","SOFTWARE_ERP":"البرمجيات وERP"};
const missing=[];
for(const [code,tables] of expected){
  const inCatalog=new RegExp(`code:['"]${code}['"]`).test(catalog);
  const name=names[code];
  const inOps=name==='كابتن' ? ops.includes("'MantiGO والنقل'") : ops.includes("'"+name+"':{key:'"+code+"'");
  const covered=tables.some(t=>ops.includes("'"+t+"'")||ops.includes('"'+t+'"'));
  if(!inCatalog) missing.push(`${code}: missing from unified catalog`);
  if(!inOps) missing.push(`${code}: no routed live workspace in operations runtime`);
  if(!covered) missing.push(`${code}: no live table binding in operations runtime`);
}
if(!ops.includes('function genericLiveView')) missing.push('genericLiveView: missing live-data workspace');
if(missing.length){console.error(missing.join('\n'));process.exit(1);}
console.log(`Module runtime coverage PASS: ${expected.length}/${expected.length} catalog modules have routed live workspaces.`);
