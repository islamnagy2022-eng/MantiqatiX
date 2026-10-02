/* MantiqatiX workspace RBAC contract — RC257
 * UI visibility is convenience only; every sensitive mutation must remain
 * protected by Supabase RLS/RPC/Edge Function authorization.
 */
(function(){
  const ALL='*';
  const ROLE_DEFAULTS={
    SUPER_ADMIN:{scope:'PLATFORM',all:true},
    OWNER:{scope:'TENANT',modules:{
      HOME:['view'],MODULES:['view'],SECTORS:['view'],USERS:['view','create','update'],CRM:['view','create','update'],
      ORDERS:['view','create','update','approve'],OPERATIONS:['view','create','update','approve'],
      FINANCE:['view','create','update','approve','export'],MARKETING:['view','create','update','approve','export'],
      ANALYTICS:['view','export'],REPORTS:['view','export'],SUPPORT:['view','create','update','approve'],
      GOVERNANCE:['view','export'],SETTINGS:['view','update'],CATALOG:['view','create','update','approve'],
      BRANCHES:['view','create','update'],PROVIDERS:['view','create','update','approve']
    }},
    BUSINESS_OWNER:{scope:'BUSINESS',modules:{
      HOME:['view'],CATALOG:['view','create','update'],ORDERS:['view','update','approve'],
      OPERATIONS:['view','create','update'],FINANCE:['view','export'],MARKETING:['view','create','update'],
      CRM:['view','create','update'],ANALYTICS:['view','export'],SUPPORT:['view','create','update'],
      BRANCHES:['view','create','update'],PROVIDERS:['view','create','update']
    }},
    ADMIN:{scope:'BUSINESS',modules:{HOME:['view'],USERS:['view','create','update'],CRM:['view','create','update'],
      ORDERS:['view','update'],OPERATIONS:['view','create','update'],CATALOG:['view','create','update'],
      MARKETING:['view','create','update'],SUPPORT:['view','create','update'],ANALYTICS:['view','export'],
      BRANCHES:['view','create','update'],PROVIDERS:['view','create','update']}},
    MANAGER:{scope:'BRANCH',modules:{HOME:['view'],CRM:['view','create','update'],ORDERS:['view','update'],
      OPERATIONS:['view','create','update'],CATALOG:['view','update'],MARKETING:['view','update'],
      SUPPORT:['view','create','update'],ANALYTICS:['view'],PROVIDERS:['view']}},
    FINANCE:{scope:'BUSINESS',modules:{HOME:['view'],FINANCE:['view','create','update','approve','export'],ORDERS:['view'],ANALYTICS:['view','export'],REPORTS:['view','export']}},
    SALES:{scope:'BUSINESS',modules:{HOME:['view'],CRM:['view','create','update'],MARKETING:['view','create','update'],ORDERS:['view','create'],ANALYTICS:['view']}},
    MARKETING:{scope:'BUSINESS',modules:{HOME:['view'],MARKETING:['view','create','update','approve','export'],CRM:['view','create','update'],ANALYTICS:['view','export'],REPORTS:['view','export']}},
    SUPPORT:{scope:'BUSINESS',modules:{HOME:['view'],SUPPORT:['view','create','update'],CRM:['view','create','update'],ORDERS:['view']}},
    SUPPORT_MANAGER:{scope:'BUSINESS',modules:{HOME:['view'],SUPPORT:['view','create','update','approve','export'],CRM:['view','create','update'],ORDERS:['view','update'],ANALYTICS:['view']}},
    EMPLOYEE:{scope:'BUSINESS',modules:{HOME:['view'],ORDERS:['view','update'],OPERATIONS:['view','update'],CRM:['view'],SUPPORT:['view','create']}},
    STAFF:{scope:'BRANCH',modules:{HOME:['view'],ORDERS:['view','update'],OPERATIONS:['view','update'],CRM:['view']}},
    SERVICE_PROVIDER:{scope:'PROVIDER',modules:{HOME:['view'],PROFILE:['view','update'],ORDERS:['view','update'],OPERATIONS:['view','update'],
      CATALOG:['view','update'],MARKETING:['view','create','update'],CRM:['view','create','update'],FINANCE:['view','export'],ANALYTICS:['view'],SUPPORT:['view','create','update']}},
    PROVIDER_OWNER:{scope:'BUSINESS',modules:{HOME:['view'],PROFILE:['view','update'],ORDERS:['view','update','approve'],OPERATIONS:['view','create','update'],
      CATALOG:['view','create','update','approve'],FINANCE:['view','export'],MARKETING:['view','create','update'],CRM:['view','create','update'],
      ANALYTICS:['view','export'],SUPPORT:['view','create','update'],BRANCHES:['view','create','update'],USERS:['view','create','update']}},
    PROVIDER_ADMIN:{scope:'BUSINESS',modules:{HOME:['view'],PROFILE:['view','update'],ORDERS:['view','update'],OPERATIONS:['view','create','update'],
      CATALOG:['view','create','update'],CRM:['view','create','update'],MARKETING:['view','create','update'],SUPPORT:['view','create','update']}},
    BRANCH_MANAGER:{scope:'BRANCH',modules:{HOME:['view'],ORDERS:['view','update'],OPERATIONS:['view','create','update'],CATALOG:['view','update'],CRM:['view','create','update'],ANALYTICS:['view']}},
    PROVIDER_FINANCE:{scope:'BUSINESS',modules:{HOME:['view'],FINANCE:['view','create','update','export'],ORDERS:['view'],ANALYTICS:['view','export']}},
    PROVIDER_MARKETING:{scope:'BUSINESS',modules:{HOME:['view'],MARKETING:['view','create','update','approve','export'],CRM:['view','create','update'],ANALYTICS:['view','export']}},
    PROVIDER_OPERATIONS:{scope:'BRANCH',modules:{HOME:['view'],ORDERS:['view','update'],OPERATIONS:['view','create','update'],CRM:['view'],SUPPORT:['view','create','update']}},
    PROVIDER_SUPPORT:{scope:'BUSINESS',modules:{HOME:['view'],SUPPORT:['view','create','update'],CRM:['view','create','update'],ORDERS:['view']}}
  };
  const ALIASES={
    'الرئيسية':'HOME','الموديولات':'MODULES','المجالات والخدمات':'SECTORS','المستخدمون وCRM':'CRM',
    'المستخدمون':'USERS','الطلبات والعمليات':'ORDERS','الطلبات':'ORDERS','التسويق والإعلان':'MARKETING',
    'خدمات التسويق الرقمي SMM':'MARKETING','العمولات والباقات':'FINANCE','التقارير والتحليلات':'ANALYTICS',
    'التقارير':'REPORTS','الدعم والحوكمة':'GOVERNANCE','الدعم':'SUPPORT','الإعدادات':'SETTINGS',
    'ملف نشاطي':'PROFILE','التجارة والأزياء':'CATALOG','البقالة والسوبر ماركت':'CATALOG','المطاعم والمطابخ':'CATALOG',
    'الخدمات المهنية':'OPERATIONS','الصيانة':'OPERATIONS','MantiGO والمزايدات':'OPERATIONS','المنظومة الطبية':'OPERATIONS'
  };
  function roleOf(role){return String(role||'CUSTOMER').trim().toUpperCase()}
  function codeOf(module){return ALIASES[module]||String(module||'').trim().toUpperCase().replace(/[\s-]+/g,'_')}
  function can(role,module,action='view',permissions){
    const r=roleOf(role), p=permissions||{};
    if(r==='SUPER_ADMIN') return p.scope==='PLATFORM' && p.full_control===true;
    const spec=ROLE_DEFAULTS[r];
    if(!spec) return false;
    const list=spec.modules?.[codeOf(module)]||[];
    return list.includes(action);
  }
  function isPrivileged(role){return ['SUPER_ADMIN','OWNER','ADMIN','BUSINESS_OWNER','MANAGER'].includes(roleOf(role))}
  function scope(role){return ROLE_DEFAULTS[roleOf(role)]?.scope||'USER'}
  function providerRole(role){return /^PROVIDER_|^SERVICE_PROVIDER$|^BRANCH_MANAGER$/.test(roleOf(role))}
  function ownerRole(role){return ['OWNER','BUSINESS_OWNER','PROVIDER_OWNER'].includes(roleOf(role))}
  window.MNTY_RBAC={ROLE_DEFAULTS,ALIASES,roleOf,codeOf,can,isPrivileged,scope,providerRole,ownerRole};
})();