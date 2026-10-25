import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20261025200000_rc568_digital_page_manual_activation.sql',
  'utf8'
);
const editor = fs.readFileSync('web/digital-page-editor.js', 'utf8');
const editorHtml = fs.readFileSync('web/digital-page-editor.html', 'utf8');

function requireCheck(condition, message) {
  if (!condition) throw new Error(`Manual activation security check failed: ${message}`);
}

const listFn = migration.match(
  /create or replace function public\.mnty_admin_list_pending_digital_page_subscriptions\(\)[\s\S]*?\n\$\$;/i
)?.[0];
const activateFn = migration.match(
  /create or replace function public\.mnty_admin_activate_digital_page_subscription\([\s\S]*?\n\$\$;/i
)?.[0];

requireCheck(Boolean(listFn), 'pending-order RPC body exists with valid dollar quoting');
requireCheck(Boolean(activateFn), 'activation RPC body exists with valid dollar quoting');
requireCheck(/language plpgsql[\s\S]*?security definer[\s\S]*?set search_path = pg_catalog, public/i.test(listFn), 'list RPC is SECURITY DEFINER with fixed search_path');
requireCheck(/auth\.uid\(\) is null or not coalesce\(public\.mnty_can_platform_admin\(\), false\)/.test(listFn), 'pending queue requires an authenticated platform admin');
requireCheck(/page_type = 'PORTFOLIO'[\s\S]*?payment_status = 'PENDING'[\s\S]*?limit 50/i.test(listFn), 'queue returns only bounded pending PORTFOLIO orders');
requireCheck(/auth\.uid\(\) is null or not coalesce\(public\.mnty_can_platform_admin\(\), false\)/.test(activateFn), 'activation requires an authenticated platform admin');
requireCheck(/p_payment_reference[\s\S]*?MANUAL_PAYMENT_REFERENCE_REQUIRED/.test(activateFn), 'activation requires a bounded external reference');
requireCheck(/from public\.digital_page_orders[\s\S]*?where id = p_order_id\s+for update/i.test(activateFn), 'activation locks the target order row');
requireCheck(/v_order\.page_type <> 'PORTFOLIO'/.test(activateFn), 'activation rejects non-portfolio order types');
requireCheck(/v_order\.payment_status <> 'PENDING'/.test(activateFn), 'activation rejects orders that are not pending');
requireCheck(/update public\.digital_page_orders[\s\S]*?set payment_status = 'PAID'[\s\S]*?insert into public\.digital_page_manual_activation_audit/i.test(activateFn), 'order state and audit insert execute in one database function transaction');
requireCheck(/order_id uuid not null unique references public\.digital_page_orders\(id\) on delete restrict/.test(migration), 'audit row is unique per order and cannot be detached by deleting the order');
requireCheck(/actor_user_id uuid not null references auth\.users\(id\) on delete restrict/.test(migration), 'audit stores a valid actor and protects actor history');
requireCheck(/amount numeric not null[\s\S]*?currency text not null[\s\S]*?activated_at timestamptz not null/i.test(migration), 'audit captures amount, currency, and activation timestamp');
requireCheck(/alter table public\.digital_page_manual_activation_audit enable row level security/i.test(migration), 'audit table enables RLS');
requireCheck(/for select\s+to authenticated\s+using \(coalesce\(public\.mnty_can_platform_admin\(\), false\)\)/i.test(migration), 'audit reads are platform-admin-only');
requireCheck(/revoke all on function public\.mnty_admin_activate_digital_page_subscription\(uuid, text, text\) from public, anon/i.test(migration), 'activation RPC is not executable by PUBLIC or anon');
requireCheck(/grant execute on function public\.mnty_admin_activate_digital_page_subscription\(uuid, text, text\) to authenticated/i.test(migration), 'activation RPC is granted only to authenticated with internal admin guard');
requireCheck(/mnty_admin_list_pending_digital_page_subscriptions/.test(editor) && /mnty_admin_activate_digital_page_subscription/.test(editor), 'admin UI uses protected RPCs rather than direct paid-state writes');
requireCheck(/مرجع التحويل بعد التحقق/.test(editor) && /هل تحققت بنفسك من استلام المبلغ/.test(editor), 'admin UI requires a reference and explicit verification confirmation');
requireCheck(/id="manual-activation-panel"/.test(editorHtml), 'admin activation panel exists');

console.log('Digital-page manual activation security contract: PASS (source-level checks only; not a substitute for authenticated runtime E2E).');
