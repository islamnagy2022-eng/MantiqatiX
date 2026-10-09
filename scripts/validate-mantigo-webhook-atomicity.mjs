import fs from "node:fs";

const migrationPath = "supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql";
const webhookPath = "supabase/functions/paymob-webhook/index.ts";
const workflowPath = ".github/workflows/pages.yml";
const migration = fs.readFileSync(migrationPath, "utf8");
const webhook = fs.readFileSync(webhookPath, "utf8");
const workflow = fs.readFileSync(workflowPath, "utf8");
const mantigoStart = webhook.indexOf("if(mantigo){");
const mantigoEnd = webhook.indexOf("const {data:intentByRef}", mantigoStart);
if (mantigoStart < 0 || mantigoEnd < 0) throw new Error("Could not isolate MantiGo payment handler.");
const mantigoBlock = webhook.slice(mantigoStart, mantigoEnd);

const requiredMigration = [
  "create table if not exists public.mantigo_payment_provider_events",
  "references public.mantigo_financial_ledger(id)",
  "revoke all on table public.mantigo_payment_provider_events from public, anon, authenticated, service_role",
  "signature_verified boolean not null check (signature_verified is true)",
  "if p_status is null or p_status not in ('PAID', 'FAILED') then",
  "enable row level security",
  "force row level security",
  "process_verified_mantigo_payment_backend",
  "for update",
  "MANTIGO_PAYMENT_SIGNATURE_REQUIRED",
  "MANTIGO_PAYMENT_TRANSACTION_ID_REQUIRED",
  "MANTIGO_PAYMENT_EVENT_TRANSACTION_MISMATCH",
  "MANTIGO_PAYMENT_PAYLOAD_BINDING_MISMATCH",
  "MANTIGO_PAYMENT_PAYLOAD_AMOUNT_MISMATCH",
  "MANTIGO_AMOUNT_CURRENCY_MISMATCH",
  "MANTIGO_PAYMENT_EVENT_ORDER_MISMATCH",
  "MANTIGO_PAYMENT_EVENT_REPLAY_STATUS_MISMATCH",
  "from public.mantigo_payment_provider_events",
  "on conflict (provider, external_event_id) do nothing",
  "payment_status = 'PENDING'",
  "payment_status = 'FAILED' and p_status = 'PAID'",
  "insert into public.notifications",
  "revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) from anon",
  "revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) from authenticated",
  "grant execute on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) to service_role"
];
for (const marker of requiredMigration) {
  if (!migration.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error("RC425 atomic MantiGo payment migration is missing contract: " + marker);
  }
}

function splitTopLevel(sql) {
  const parts = [];
  let start = 0, depth = 0, quote = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      if (ch === quote && sql[i + 1] === quote) { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) { parts.push(sql.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(sql.slice(start).trim());
  return parts;
}
const eventInsertStart = migration.indexOf("insert into public.mantigo_payment_provider_events");
const eventValuesKeyword = eventInsertStart < 0 ? -1 : migration.indexOf("values (", eventInsertStart);
const eventColumnsStart = eventInsertStart < 0 ? -1 : migration.indexOf("(", eventInsertStart) + 1;
const eventColumnsEnd = eventValuesKeyword < 0 ? -1 : migration.lastIndexOf(")", eventValuesKeyword);
const eventValuesStart = eventValuesKeyword < 0 ? -1 : eventValuesKeyword + "values (".length;
const eventConflictStart = eventValuesStart < 0 ? -1 : migration.indexOf("on conflict (provider, external_event_id) do nothing", eventValuesStart);
const eventValuesEnd = eventConflictStart < 0 ? -1 : migration.lastIndexOf(")", eventConflictStart);
if (eventInsertStart < 0 || eventColumnsEnd < 0 || eventValuesEnd < 0) {
  throw new Error("Atomic MantiGo event insert statement was not found.");
}
const eventColumns = splitTopLevel(migration.slice(eventColumnsStart, eventColumnsEnd));
const eventValues = splitTopLevel(migration.slice(eventValuesStart, eventValuesEnd));
if (eventColumns.length !== eventValues.length) {
  throw new Error(`MantiGo provider event insert column/value mismatch: ${eventColumns.length} columns vs ${eventValues.length} values.`);
}
if (migration.includes("from public.payment_provider_events")) {
  throw new Error("MantiGo ledger events must not be read from payment_provider_events.");
}

const delimiterCount = migration.split("$function$").length - 1;
if (delimiterCount !== 2) throw new Error("RC425 SQL must contain exactly one complete function body.");
const functionCount = migration.split("create or replace function public.process_verified_mantigo_payment_backend(").length - 1;
if (functionCount !== 1) throw new Error("RC425 SQL must define the payment RPC exactly once.");
if (!migration.includes("if coalesce(p_raw_payload->>'amount_cents', '') !~ '^[0-9]+$' then")) {
  throw new Error("RC425 SQL must validate integer amount_cents before casting.");
}
const finalGrant = "grant execute on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) to service_role;";
if (!migration.trimEnd().endsWith(finalGrant)) throw new Error("RC425 SQL must end at the service_role-only function grant.");

const requiredWebhook = [
  'admin.rpc("process_verified_mantigo_payment_backend"',
  "p_ledger_id:mantigo.id",
  "p_external_event_id:eventId",
  'p_signature_verified:true',
  "p_raw_payload:mantigoPayload",
  "MANTIGO_PAYMENT_EVENT_ORDER_MISMATCH",
  "MANTIGO_AMOUNT_CURRENCY_MISMATCH"
];
for (const marker of requiredWebhook) {
  if (!mantigoBlock.includes(marker)) {
    throw new Error("Paymob webhook does not use the atomic MantiGo payment contract: " + marker);
  }
}
if (!webhook.includes("if(!value(obj.id)||amount<=0||!Number.isFinite(amount)||!currency)")) {
  throw new Error("Paymob webhook must reject callbacks without a valid transaction ID, amount, and currency.");
}
const directWritePatterns = [
  [/admin\.from\("mantigo_payment_provider_events"\)\.insert\(/, "direct provider-event insert"],
  [/admin\.from\("mantigo_financial_ledger"\)\.update\(/, "direct MantiGo ledger update"],
  [/admin\.from\("notifications"\)\.insert\(/, "out-of-transaction payment notification"]
];
for (const [pattern, label] of directWritePatterns) {
  if (pattern.test(mantigoBlock)) throw new Error("MantiGo webhook still contains " + label);
}
if (!workflow.includes("node scripts/validate-mantigo-webhook-atomicity.mjs")) {
  throw new Error("Atomic MantiGo Paymob webhook validator is not wired into CI.");
}
console.log("RC425 atomic MantiGo Paymob webhook contract: PASS (source-only; production migration and real Paymob E2E still require separate verification).");
