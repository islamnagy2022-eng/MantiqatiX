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
if(!operations.includes("invokeErpApi({operation:'list',tenantId:activeScope.tenant_id,businessId:activeScope.business_id")) throw new Error('operations ERP modules are not connected to the authenticated API gateway');
if(!operations.includes("eq('id',activeScope.business_id).eq('tenant_id',activeScope.tenant_id)")) throw new Error('business ERP summary is not tenant/business scoped');
if(!operations.includes('ERP_DATA_LOAD_FAILED')) throw new Error('operations ERP runtime errors are silently treated as empty data');
if(!operations.includes("tables:['erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','warehouses','catalog_items']")) throw new Error('ERP module does not include its product catalog link');
if(!operations.includes("if(businessScoped.includes(t)&&activeScope?.business_id)q=q.eq('business_id',activeScope.business_id)")) throw new Error('operations product catalog reads are not business-scoped');
if(!app.includes("function erpWarehouseLabel(rows,id)")) throw new Error('enterprise ERP warehouse references are not linked to warehouse names');
if(!app.includes("function erpProductLabel(rows,id)")) throw new Error('enterprise ERP product references are not linked to catalog names');
if(!operations.includes('function erpOperationsWorkspace(d)')) throw new Error('operations ERP workspace does not render linked operational records');
if(!operations.includes('onclick="createPurchaseOrder()"') || !operations.includes('onclick="receivePurchaseStock()"') || !operations.includes('onclick="createStockTransfer()"')) throw new Error('ERP operations workspace must expose purchase, receiving, and transfer actions');
if(!operations.includes("x[2]===true")) throw new Error('ERP action cells must use the explicit safe-action renderer');
if(!operations.includes('function factoryOperationsWorkspace(d)') || !operations.includes('rows.inventory_transactions')) throw new Error('factory workspace must link inventory balances and movement history');


const api=fs.readFileSync('supabase/functions/api/index.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20261020150000_rc461_erp_runtime_service_gateway.sql','utf8');
const loader=app.slice(app.indexOf('async function loadEnterpriseDomainData'),app.indexOf('async function loadRestaurantWorkspace'));
if(!loader.includes('MNTY_BACKEND_ONLY_TABLES.has(table)')) throw new Error('enterprise module loader does not guard backend-only tables');
if(!loader.includes("invokeMntyApi('/api/v1/erp/runtime',{method:'POST',body:{operation:'list'")) throw new Error('ERP reads are not connected to the authenticated server gateway');
if(!app.includes("invokeMntyApi('/api/v1/erp/runtime',{method:'POST',body:{operation:'mutate'")) throw new Error('ERP mutations are not connected to the server gateway');
if(!api.includes('path === "/api/v1/erp/runtime"') || !api.includes('supabaseAdmin.rpc("erp_runtime_execute"')) throw new Error('deployed API ERP gateway route is missing');
if(!api.includes('from("catalog_items").select("*").eq("tenant_id", tenantId).eq("business_id", businessId)')) throw new Error('ERP product lookup is not tenant/business scoped');
if(!api.includes('String(args.p_tenant_id ?? "") !== tenantId') || !api.includes('String(args.p_business_id ?? "") !== businessId')) throw new Error('ERP mutations are not bound to the active tenant/business selection');
if(!api.includes('ERP_WAREHOUSE_SELECTION_INVALID') || !api.includes('ERP_SCOPE_MISMATCH')) throw new Error('ERP mutation preflight scope guards are missing');
if(!migration.includes('revoke all on function public.erp_runtime_execute(uuid,text,jsonb) from public, anon, authenticated')) throw new Error('ERP gateway RPC must remain service-role-only');
console.log('Backend-only module boundary and ERP runtime gateway PASS');
