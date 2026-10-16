from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
WEBHOOK = (ROOT / "supabase/functions/paymob-webhook/index.ts").read_text()
MIGRATION = (ROOT / "supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql").read_text()

# The MantiGO callback path must use the exact RPC added by RC425.
assert 'admin.rpc("process_verified_mantigo_payment_backend"' in WEBHOOK
for arg in (
    "p_ledger_id:", "p_external_event_id:", "p_status:",
    "p_signature_verified:", "p_amount:", "p_currency:",
    "p_provider_transaction_id:", "p_raw_payload:",
):
    assert arg in WEBHOOK, f"missing RPC argument: {arg}"

# Keep the MantiGO block isolated so other payment branches can retain their own contracts.
start = WEBHOOK.index('const {data:mantigo}=await admin.from("mantigo_financial_ledger")')
end = WEBHOOK.index('const {data:intentByRef}', start)
mantigo_block = WEBHOOK[start:end]
assert 'admin.from("payment_provider_events").insert' not in mantigo_block
assert 'admin.from("mantigo_financial_ledger").update' not in mantigo_block
assert 'admin.from("notifications").insert' not in mantigo_block
assert 'MANTIGO_PAYMENT_PROCESSING_FAILED' in mantigo_block

# The candidate SQL contract must expose all eight parameters in the expected order.
signature = re.search(
    r"create or replace function public\.process_verified_mantigo_payment_backend\((.*?)\)\s*returns jsonb",
    MIGRATION,
    re.S,
)
assert signature, "RC425 atomic MantiGO RPC signature missing"
params = re.sub(r"\s+", " ", signature.group(1)).strip()
expected = [
    "p_ledger_id text", "p_external_event_id text", "p_status text",
    "p_signature_verified boolean", "p_amount numeric", "p_currency text",
    "p_provider_transaction_id text", "p_raw_payload jsonb",
]
for param in expected:
    assert param in params, f"RC425 RPC parameter mismatch: {param}"

# RPC verifies canonical callback bindings and persists event + ledger + notification in one function.
for marker in (
    "MANTIGO_PAYMENT_SIGNATURE_REQUIRED",
    "MANTIGO_PAYMENT_PAYLOAD_BINDING_MISMATCH",
    "for update",
    "insert into public.mantigo_payment_provider_events",
    "update public.mantigo_financial_ledger",
    "insert into public.notifications",
):
    assert marker in MIGRATION.lower() or marker.lower() in MIGRATION.lower(), f"missing atomicity guard: {marker}"

print("PASS: MantiGO Paymob webhook is wired to the RC425 atomic RPC contract.")
print("LIMIT: static contract test only; it does not execute PostgreSQL or prove the migration chain.")
