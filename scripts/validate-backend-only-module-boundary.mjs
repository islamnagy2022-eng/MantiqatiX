import fs from 'node:fs';
const app=fs.readFileSync('web/app.js','utf8');
const ops=fs.readFileSync('web/operations-modules.js','utf8');
const blocked=['erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','smm_admins','smm_provider_credentials','smm_providers'];
if(!app.includes('MNTY_BACKEND_ONLY_TABLES=new Set')) throw new Error('backend-only table guard missing');
for(const t of blocked){ if(!app.includes(t)) throw new Error('missing backend-only table '+t); }
const marker=app.indexOf('async function loadDomainModule');
const body=app.slice(marker,marker+1800);
if(!body.includes('MNTY_BACKEND_ONLY_TABLES.has(t)')) throw new Error('loadDomainModule does not enforce backend-only boundary');
if(!ops.includes('BACKEND_ONLY_TABLES=new Set')) throw new Error('operations module backend-only guard missing');
if(!ops.includes('BACKEND_ONLY_TABLES.has(t)')) throw new Error('operations module does not enforce backend-only boundary');
console.log('Backend-only module read boundary PASS');
