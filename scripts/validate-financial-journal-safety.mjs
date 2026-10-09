import fs from "node:fs";

const migration=fs.readFileSync("supabase/migrations/20261009220000_rc436_atomic_financial_journal.sql","utf8");
const edge=fs.readFileSync("supabase/functions/post-financial-journal/index.ts","utf8");
const legacyEdge=fs.readFileSync("supabase/functions/financial-journal/index.ts","utf8");
const ui=fs.readFileSync("web/app.js","utf8");
const integration=fs.readFileSync("supabase/tests/rc436_financial_journal_integration.sql","utf8");
const checks=[];
function check(name,ok){checks.push({name,ok:Boolean(ok)});if(!ok)console.error("FAIL "+name);}
check("primary journal Edge Function calls atomic backend RPC",edge.includes('rpc("post_financial_journal_atomic_backend"')&&!edge.includes('rpc("post_financial_journal_backend"'));
check("legacy journal Edge Function uses same atomic backend RPC",legacyEdge.includes('rpc("post_financial_journal_atomic_backend"')&&!legacyEdge.includes('rpc("post_financial_journal"'));
check("journal ID is required for safe retries",edge.includes("JOURNAL_ID_REQUIRED")&&legacyEdge.includes("JOURNAL_ID_REQUIRED"));
check("manual journal UI persists stable idempotency ID",ui.includes("mantiqatix_financial_journal_attempt")&&ui.includes("id:attempt.id"));
check("journal schema aligns totals, entry number, posted time and line number",migration.includes("add column if not exists total_debit")&&migration.includes("add column if not exists total_credit")&&migration.includes("add column if not exists line_number"));
check("journal RPC validates balanced totals and tenant account scope",migration.includes("UNBALANCED_JOURNAL")&&migration.includes("ACCOUNT_NOT_ACTIVE_FOR_TENANT"));
check("journal posting uses advisory lock and idempotency conflict detection",migration.includes("pg_advisory_xact_lock")&&migration.includes("JOURNAL_IDEMPOTENCY_CONFLICT"));
check("journal and ledger writes are atomic",migration.includes("insert into public.journal_entries")&&migration.includes("insert into public.journal_entry_lines")&&migration.includes("insert into public.general_ledger"));
check("legacy security-definer functions receive empty search_path",migration.includes("alter function public.post_financial_journal(jsonb,jsonb) set search_path = ''")&&migration.includes("alter function public.post_financial_journal_backend(uuid,jsonb,jsonb) set search_path = ''"));
check("integration test covers retry, authorization, imbalance and rollback",integration.includes("same journal retry must be idempotent")&&integration.includes("FINANCIAL_MEMBERSHIP_REQUIRED")&&integration.includes("UNBALANCED_JOURNAL")&&integration.includes("RC436_FORCED_LEDGER_FAILURE"));
const failed=checks.filter(x=>!x.ok);if(failed.length)process.exit(1);
console.log("Financial journal safety contract PASS: "+checks.length+"/"+checks.length+" checks.");
