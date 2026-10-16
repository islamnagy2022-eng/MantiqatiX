import fs from "node:fs";
const verifier=fs.readFileSync("scripts/production/verify-production.mjs","utf8");
const workflow=fs.readFileSync(".github/workflows/pages.yml","utf8");
const edge=fs.readFileSync("supabase/functions/digital-page-payment-intent/index.ts","utf8");
const migration=fs.readFileSync("supabase/migrations/20261007003432_digital_page_payment_intent_claim_boundary_v1.sql","utf8");
const todo=fs.readFileSync("docs/MASTER_PRODUCTION_TODO.md","utf8");
const required=[
  [verifier,'DIG-FINALIZE-TRUST-BOUNDARY','production verifier includes the P0 gate'],
  [verifier,'digitalFinalizerUsesUserClient','gate detects the user-scoped finalizer call'],
  [verifier,'digitalFinalizerGrantsAuthenticated','gate detects authenticated EXECUTE grant'],
  [workflow,'validate-digital-page-finalization-gate.mjs','CI invokes the contract validator'],
  [edge,'userClient.rpc("finalize_digital_page_payment_intent_backend"','current direct finalizer call is covered'],
  [migration,'grant execute on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) to authenticated;','current grant is covered'],
  [todo,'Digital-page payment finalization trust boundary — BLOCKED','release register names the blocker']
];
for(const [src,marker,label] of required) if(!src.includes(marker)) throw new Error("Digital finalization gate contract missing: "+label);
console.log("Digital-page payment finalization gate contract: PASS (current unsafe source state is intentionally classified BLOCKED by production verification).");
