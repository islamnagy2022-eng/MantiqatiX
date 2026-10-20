import fs from 'node:fs';
const app=fs.readFileSync('web/app.js','utf8');
const operations=fs.readFileSync('web/operations-modules.js','utf8');
const blocked=['erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','smm_admins','smm_provider_credentials','smm_providers'];
if(!app.includes('MNTY_BACKEND_ONLY_TABLES=new Set')) throw new Error('backend-only table guard missing');
for(const t of blocked){ if(!app.includes(t)) throw new Error('missing backend-only table '+t); }
const marker=app.indexOf('async function loadDomainModule');
const body=app.slice(marker,marker+1800);
if(!body.includes('MNTY_BACKEND_ONLY_TABLES.has(t)')) throw new Error('loadDomainModule does not enforce backend-only boundary');
if(!operations.includes('BACKEND_ONLY_TABLES=new Set')) throw new Error('operations backend-only table guard missing');
if(!operations.includes('BACKEND_ONLY_TABLES.has(t)')) throw new Error('operations load does not enforce backend-only boundary');
if(!operations.includes("sb.functions.invoke('erp-runtime',{body:{operation:'list'")) throw new Error('operations ERP modules are not connected to the authenticated runtime gateway');
if(!operations.includes("eq('id',activeScope.business_id).eq('tenant_id',activeScope.tenant_id)")) throw new Error('business ERP summary is not tenant/business scoped');
if(!operations.includes('ERP_DATA_LOAD_FAILED')) throw new Error('operations ERP runtime errors are silently treated as empty data');
if(!operations.includes("tables:['erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','warehouses','catalog_items']")) throw new Error('ERP module does not include its product catalog link');
if(!operations.includes("q=q.eq('business_id',scope().business_id).limit(150)")) throw new Error('operations product catalog reads are not business-scoped');
if(!app.includes("function erpWarehouseLabel(rows,id)")) throw new Error('enterprise ERP warehouse references are not linked to warehouse names');
if(!app.includes("function erpProductLabel(rows,id)")) throw new Error('enterprise ERP product references are not linked to catalog names');
if(!operations.includes('function erpOperationsWorkspace(d)')) throw new Error('operations ERP workspace does not render linked operational records');


const gateway=fs.readFileSync('supabase/functions/erp-runtime/index.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20261020150000_rc461_erp_runtime_service_gateway.sql','utf8');
const loader=app.slice(app.indexOf('async function loadEnterpriseDomainData'),app.indexOf('async function loadRestaurantWorkspace'));
if(!loader.includes('MNTY_BACKEND_ONLY_TABLES.has(table)')) throw new Error('enterprise module loader does not guard backend-only tables');
if(!loader.includes("invokeMntyFunction('erp-runtime',{operation:'list'")) throw new Error('ERP reads are not connected to the authenticated server gateway');
if(!app.includes("invokeMntyFunction('erp-runtime',{operation:'mutate'")) throw new Error('ERP mutations are not connected to the server gateway');
if(!gateway.includes('admin.rpc("erp_runtime_execute"')) throw new Error('ERP gateway does not call the restricted actor-aware RPC');
if(!gateway.includes('ERP_BRANCH_SCOPE_REQUIRED') || !gateway.includes('ERP_BUSINESS_SCOPE_INVALID')) throw new Error('ERP gateway scope checks are incomplete');
if(!migration.includes('revoke all on function public.erp_runtime_execute(uuid,text,jsonb) from public, anon, authenticated')) throw new Error('ERP gateway RPC must remain service-role-only');
console.log('Backend-only module boundary and ERP runtime gateway PASS');
