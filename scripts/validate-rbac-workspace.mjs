import fs from 'node:fs';
const rbac=fs.readFileSync('web/rbac.js','utf8');
const app=fs.readFileSync('web/app.js','utf8');
const index=fs.readFileSync('web/index.html','utf8');
const requiredRoles=['SUPER_ADMIN','OWNER','BUSINESS_OWNER','ADMIN','MANAGER','FINANCE','SALES','MARKETING','SUPPORT','SUPPORT_MANAGER','EMPLOYEE','STAFF','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_FINANCE','PROVIDER_MARKETING','PROVIDER_OPERATIONS','PROVIDER_SUPPORT'];
for(const role of requiredRoles){
 if(!rbac.includes(role)) throw new Error('RBAC role missing: '+role);
}
for(const marker of ['window.MNTY_RBAC','ROLE_DEFAULTS','function can(','function scope(','function providerRole(','function ownerRole(']){
 if(!rbac.includes(marker)) throw new Error('RBAC contract marker missing: '+marker);
}
for(const marker of ["await load('rbac.js?v=mnty120')","case'الرئيسية':return canSuperAdmin()","window.MNTY_RBAC?.can(r,'ORDERS','update',live.permissions)","const rbacKnown=!!window.MNTY_RBAC?.ROLE_DEFAULTS?.[role]"]){
 if(!index.includes(marker) && !app.includes(marker)) throw new Error('RBAC integration marker missing: '+marker);
}
if(!/function roleWorkspaceDashboard\(\)/.test(app)) throw new Error('Role workspace dashboard missing');
if(!/function canSuperAdmin\(\)[\s\S]*window\.MNTY_RBAC/.test(app)) throw new Error('Super Admin RBAC guard missing');
console.log('RC257 RBAC/workspace contract: PASS');
