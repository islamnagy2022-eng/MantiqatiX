import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20261028093854_rc452_flexible_commission_rule_drafts.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const previewMigration = fs.readFileSync('supabase/migrations/20261028103744_rc455_commission_draft_preview.sql', 'utf8');
const resolutionMigration = fs.readFileSync('supabase/migrations/20261028105500_rc456_commission_resolution_preview.sql', 'utf8');
const resolutionTest = fs.readFileSync('supabase/tests/rc456_commission_resolution_preview_integration.sql', 'utf8');
const ui = fs.readFileSync('apps/catalog-frontend/src/components/admin/CommissionRulesManager.tsx', 'utf8');
const admin = fs.readFileSync('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx', 'utf8');

const checks = [
  ['new rule schema supports required commission calculation modes', /calculation_mode in \('LEGACY','PERCENTAGE','FIXED','COMBINED'\)/.test(migration)],
  ['scope dimensions include tenant, business, category, product, service, plan and agreement', /'TENANT','BUSINESS','CATEGORY','PRODUCT','SERVICE','PLAN','AGREEMENT'/.test(migration)],
  ['eligibility event is required for saved drafts', /ELIGIBILITY_EVENT_REQUIRED/.test(migration) && /eligibility_event/.test(ui)],
  ['effective dates and priority are constrained', /commission_rules_effective_period_check/.test(migration) && /commission_rules_priority_check/.test(migration)],
  ['audit table is RLS protected and not exposed to browser users', /enable row level security[\s\S]*?force row level security[\s\S]*?revoke all on public\.commission_rule_audit from public, anon, authenticated/i.test(migration)],
  ['commission changes have a database audit trigger', /trg_commission_rules_audit[\s\S]*?after insert or update or delete/i.test(migration)],
  ['draft RPC validates authenticated, non-anonymous user and scoped permissions', /AUTH_REQUIRED/.test(migration) && /COMMISSION_RULE_FORBIDDEN/.test(migration) && /user_memberships/.test(migration)],
  ['new rules are always created inactive and as DRAFT', /null,false,v_name,v_description,v_mode[\s\S]*?'DRAFT',1,v_actor,v_actor/.test(migration)],
  ['draft updates cannot change active/legacy rules', /coalesce\(v_existing\.active,false\) or v_existing\.approval_status <> 'DRAFT'/.test(migration)],
  ['UI explicitly communicates rules remain inactive until engine integration', /مسودات غير مفعّلة/.test(ui) && /لا يوجد زر تفعيل/.test(ui)],
  ['admin dashboard exposes the commission manager', /CommissionRulesManager/.test(admin) && /'commissions'/.test(admin)],
  ['no frontend action attempts to activate or apply a commission rule', !/p_action:\s*['"](?:ACTIVATE|APPROVE|APPLY)['"]/.test(ui)],
  ['commission audit history is available through the scoped draft RPC', /v_action = 'AUDIT'/.test(migration) && /p_action:'AUDIT'/.test(ui)],
  ['audit history is capped at 100 tenant-scoped records', /where tenant_id = p_tenant_id[\s\S]*?order by created_at desc[\s\S]*?limit 100/.test(migration)],
  ['commission preview is callable only by authenticated users', previewMigration.includes('AUTH_REQUIRED') && previewMigration.includes('COMMISSION_RULE_FORBIDDEN') && previewMigration.includes('grant execute on function public.preview_commission_rule_draft(varchar, varchar, numeric) to authenticated')],
  ['preview can only calculate inactive DRAFT rules', previewMigration.includes('r.active = false') && previewMigration.includes("r.approval_status = 'DRAFT'" )],
  ['preview supports percentage fixed combined and exemption formulas', previewMigration.includes("when 'PERCENTAGE'") && previewMigration.includes("when 'FIXED'") && previewMigration.includes("when 'COMBINED'") && previewMigration.includes('v_rule.is_exempt')],
  ['preview validates monetary bounds and refuses commission above gross', /INVALID_DRAFT_RULE_AMOUNT/.test(previewMigration) && /INVALID_DRAFT_RULE_BOUNDS/.test(previewMigration) && /PREVIEW_COMMISSION_EXCEEDS_GROSS/.test(previewMigration)],
  ['preview RPC is explicitly non-posting and read-only', previewMigration.includes("'preview_only', true") && previewMigration.includes("'applies_to_orders', false") && !['insert into public.orders','insert into public.commission_transactions','insert into public.financial_obligations','update public.orders','update public.commission_transactions','delete from public.commission_rules'].some(statement => previewMigration.toLowerCase().includes(statement))],
  ['admin UI exposes preview-only simulation and displays net/commission results', /preview_commission_rule_draft/.test(ui) && /معاينة افتراضية فقط/.test(ui) && /provider_net_amount/.test(ui) && /لا تُستخدم في الطلبات/.test(ui)],
  ['scope-resolution preview is authenticated and anon execution is revoked', resolutionMigration.includes('AUTH_REQUIRED') && resolutionMigration.includes('COMMISSION_RULE_FORBIDDEN') && resolutionMigration.includes('grant execute on function public.preview_commission_rule_resolution(varchar, uuid, varchar, text, text, text, text, numeric) to authenticated')],
  ['resolution preview only considers inactive DRAFT rules', resolutionMigration.includes("r.active = false") && resolutionMigration.includes("r.approval_status = 'DRAFT'")],
  ['resolution preview filters scope, event, module and effective dates', resolutionMigration.includes("r.eligibility_event = v_event") && resolutionMigration.includes("r.module_id is null or r.module_id = p_module_id") && resolutionMigration.includes("r.effective_from <= now()") && resolutionMigration.includes("r.effective_to >= now()") && resolutionMigration.includes("r.scope_ref = v_category_ref")],
  ['resolution policy is deterministic: priority, specificity, update timestamp, stable id', resolutionMigration.includes("order by rule_priority desc, specificity_rank desc, updated_at desc, id asc") && resolutionMigration.includes("'priority DESC, specificity DESC, updated_at DESC, rule_id ASC'")],
  ['resolution preview returns selected rule calculation without posting financial data', resolutionMigration.includes("public.preview_commission_rule_draft(p_tenant_id,v_winner_id,p_gross_amount)") && resolutionMigration.includes("'preview_only',true") && resolutionMigration.includes("'applies_to_orders',false") && !/insert into public\.(orders|commission_transactions|financial_obligations|ledger_entries)|update public\.(orders|commission_rules|commission_transactions|financial_obligations)|delete from public\.(orders|commission_rules|commission_transactions|financial_obligations)/i.test(resolutionMigration)],
  ['commission manager provides a read-only scope-resolution preview', /preview_commission_rule_resolution/.test(ui) && /معاينة أولوية النطاقات المتداخلة/.test(ui) && /الاختيار الأول/.test(ui) && /تحليل القواعد المتداخلة/.test(ui)],
  ['scope-resolution integration covers priority, specificity, business/category matching and auth', /RC456_SPECIFICITY_RESOLUTION_MISMATCH/.test(resolutionTest) && /RC456_PRIORITY_RESOLUTION_MISMATCH/.test(resolutionTest) && /RC456_EVENT_FILTER_MISMATCH/.test(resolutionTest) && /COMMISSION_RULE_FORBIDDEN/.test(resolutionTest)],
];

const failed = checks.filter(([name, passed]) => {
  if (!passed) console.error('FAIL:', name);
  return !passed;
});
if (failed.length) process.exit(1);
console.log(`Commission-drafts security contract passed (${checks.length} checks).`);
