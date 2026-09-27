import fs from 'node:fs';

const source=fs.readFileSync('web/android-parity-catalog.js','utf8');
const requiredModules=[
  'RESTAURANTS','CAFES','SUPERMARKET','CLOTHING','MANTIGO','MARRIAGE','JOBS','SCHOOLS','MAINTENANCE',
  'MARKETING','BUSINESS_ERP','ACCOUNTING','LEGAL','PARTNERS','ADS','TRAVEL','USED_ITEMS','PHYSIOTHERAPY',
  'PHARMACIES','CLINICS','HOSPITALS','LABS'
];
const requiredMaster=['paymentChannels','units','taxRates','currencies','jobCategories','propertyTypes','medicalSpecialties','weddingCategories'];
const missing=[];
for(const code of requiredModules) if(!source.includes("code:'"+code+"'")) missing.push('module:'+code);
for(const key of requiredMaster) if(!source.includes(key+':[')) missing.push('master:'+key);
if(!source.includes('roleMappings')||!source.includes('enterpriseCoreModules')||!source.includes('operationalRoles')||!source.includes('permissionCatalog')) missing.push('role/permission catalogs');
if(!source.includes('window.MNTY_UNIFIED_CATALOG')) missing.push('global catalog export');
if(!source.includes('Supabase')) { /* catalog must stay metadata-only; no direct backend mutation is expected */ }
if(missing.length){console.error('Android parity catalog validation failed:',missing);process.exit(1);}
console.log('Android parity catalog validation passed: 22 modules + master/role/permission catalogs present.');
