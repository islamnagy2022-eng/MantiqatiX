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
  "enable row level security",
  "force row level security",
  "process_verified_mantigo_payment_backend",
  "for update",
  "MANTIGO_PAYMENT_SIGNATURE_REQUIRED",
  "MANTIGO_AMOUNT_CURRENCY_MISMATCH",
  "MANTIGO_PAYMENT_EVENT_ORDER_MISMATCH",
  "MANTIGO_PAYMENT_EVENT_REPLAY_STATUS_MISMATCH",
  "from public.mantigo_payment_provider_events",
  "on conflict (provider, external_event_id) do nothing",
  "payment_status = 'PENDING'",
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

const requiredWebhook = [
  'admin.rpc("process_verified_mantigo_payment_backend"',
  "p_ledger_id:mantigo.id",
  "p_external_event_id:eventId",
  'p_signature_verified:true',
  "p_raw_payload:raw",
  "MANTIGO_PAYMENT_EVENT_ORDER_MISMATCH",
  "MANTIGO_AMOUNT_CURRENCY_MISMATCH"
];
for (const marker of requiredWebhook) {
  if (!mantigoBlock.includes(marker)) {
    throw new Error("Paymob webhook does not use the atomic MantiGo payment contract: " + marker);
  }
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
