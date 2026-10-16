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


# The other verified webhook branches must also use their atomic candidate RPCs.
assert 'admin.rpc("process_verified_provider_payment_failure"' in WEBHOOK
assert 'admin.rpc("process_verified_subscription_payment_failure"' in WEBHOOK
assert 'admin.rpc("process_verified_subscription_payment_backend"' in WEBHOOK
assert "p_provider_order_id:" in WEBHOOK
assert "p_raw_payload:" in WEBHOOK

order_start = WEBHOOK.index('const {data:intentByRef}')
order_block = WEBHOOK[order_start:]
assert 'admin.from("payment_provider_events").insert' not in order_block
assert 'admin.from("payment_intents").update' not in order_block
assert 'process_verified_provider_payment_failure' in order_block

sub_start = WEBHOOK.index('const {data:subByRef}')
sub_end = WEBHOOK.index('const {data:digitalByRef}', sub_start)
sub_block = WEBHOOK[sub_start:sub_end]
assert 'process_verified_subscription_payment_failure' in sub_block
assert 'process_verified_subscription_payment_backend' in sub_block
assert 'admin.from("subscription_payment_intents").update' not in sub_block
assert 'admin.from("payment_provider_events").select' not in sub_block

ORDER_FAILURE_MIGRATION = (ROOT / "supabase/migrations/20261009150000_rc428_atomic_provider_failure_webhook.sql").read_text()
SUB_FAILURE_MIGRATION = (ROOT / "supabase/migrations/20261009160000_rc429_atomic_subscription_failure_webhook.sql").read_text()
SUB_SUCCESS_MIGRATION = (ROOT / "supabase/migrations/20261009170000_rc430_atomic_subscription_success_webhook.sql").read_text()
for source, function_name in (
    (ORDER_FAILURE_MIGRATION, "process_verified_provider_payment_failure"),
    (SUB_FAILURE_MIGRATION, "process_verified_subscription_payment_failure"),
    (SUB_SUCCESS_MIGRATION, "process_verified_subscription_payment_backend"),
):
    assert f"create or replace function public.{function_name}" in source
    assert "for update" in source.lower(), f"row lock missing in {function_name}"
    assert "external_event_id" in source, f"event idempotency binding missing in {function_name}"

print("PASS: MantiGO, order failure, subscription failure, and subscription success use their candidate atomic RPC contracts.")
print("LIMIT: static contract tests only; PostgreSQL replay, RPC integration, and provider sandbox remain required.")


# The finalizer is a trusted server-only RPC; the authenticated client may claim/release but never finalize.
# RC426 requires the provider order correlation to be persisted by the Edge Function.
DIGITAL_INTENT = (ROOT / "supabase/functions/digital-page-payment-intent/index.ts").read_text()
assert 'admin.rpc("finalize_digital_page_payment_intent_backend"' in DIGITAL_INTENT
assert 'userClient.rpc("finalize_digital_page_payment_intent_backend"' not in DIGITAL_INTENT
assert "reconciliationRequired:true" in DIGITAL_INTENT
DIGITAL_BINDING_MIGRATION = (ROOT / "supabase/migrations/20261009130000_rc426_digital_page_provider_order_binding.sql").read_text()
assert 'p_provider_order_id:providerOrderId' in DIGITAL_INTENT
assert 'PAYMENT_PROVIDER_ORDER_CORRELATION_MISSING' in DIGITAL_INTENT
assert 'reconciliationRequired:true' in DIGITAL_INTENT
assert "p_provider_order_id text" in DIGITAL_BINDING_MIGRATION
assert "provider_order_id = p_provider_order_id" in DIGITAL_BINDING_MIGRATION
assert "p_provider_order_id" in DIGITAL_BINDING_MIGRATION
print("PASS: digital-page payment intent passes the RC426 provider-order binding.")


# RC435/RC439/RC529 subscription intent creation must be single-claim and encrypted-recoverable.
SUBSCRIPTION_INTENT = (ROOT / "supabase/functions/subscription-payment-intent/index.ts").read_text()
CLAIM_MIGRATION = (ROOT / "supabase/migrations/20261009210000_rc435_subscription_provider_intent_claim.sql").read_text()
ENCRYPTION_MIGRATION = (ROOT / "supabase/migrations/20261010010000_rc439_encrypted_checkout_recovery.sql").read_text()
FINALIZE_MIGRATION = (ROOT / "supabase/migrations/20261016180000_rc529_atomic_subscription_provider_intent_finalize.sql").read_text()
for rpc in (
    "create_subscription_payment_intent_claimable_backend",
    "claim_subscription_provider_intent_creation_backend",
    "finalize_subscription_provider_intent_creation_backend",
):
    assert f'admin.rpc("{rpc}"' in SUBSCRIPTION_INTENT, f"subscription intent does not call {rpc}"
assert 'admin.rpc("create_subscription_payment_intent_backend"' not in SUBSCRIPTION_INTENT
assert 'admin.from("subscription_payment_intents").update' not in SUBSCRIPTION_INTENT
assert "PAYMOB_CLIENT_SECRET_ENCRYPTION_KEY" in SUBSCRIPTION_INTENT
assert 'name:"AES-GCM"' in SUBSCRIPTION_INTENT
assert "client_secret_ciphertext" in SUBSCRIPTION_INTENT
assert "client_secret_iv" in SUBSCRIPTION_INTENT
assert "client_secret_key_version" in SUBSCRIPTION_INTENT
assert "outcome_unknown===true" in SUBSCRIPTION_INTENT
assert "reconciliationRequired:true" in SUBSCRIPTION_INTENT
assert "client_secret_ciphertext: _ciphertext" in SUBSCRIPTION_INTENT
assert "client_secret_iv: _iv" in SUBSCRIPTION_INTENT
assert "client_secret_key_version: _keyVersion" in SUBSCRIPTION_INTENT
assert "paymentIntent:publicIntent(intent)" in SUBSCRIPTION_INTENT
assert "paymentIntent:safeIntent" not in SUBSCRIPTION_INTENT
assert "function publicIntent(intent:Row):Row" in SUBSCRIPTION_INTENT
assert "paymentIntent:publicIntent(intent)" in SUBSCRIPTION_INTENT
assert "provider_creation_state='CLAIMED'" in CLAIM_MIGRATION
assert "client_secret_ciphertext" in ENCRYPTION_MIGRATION
assert "client_secret_iv" in ENCRYPTION_MIGRATION
assert "client_secret_key_version" in ENCRYPTION_MIGRATION
assert "for update" in FINALIZE_MIGRATION.lower()
assert "provider_creation_state is distinct from 'CLAIMED'" in FINALIZE_MIGRATION
assert "provider_creation_state <> 'CLAIMED'" not in FINALIZE_MIGRATION
assert "grant execute" in FINALIZE_MIGRATION.lower() and "to service_role" in FINALIZE_MIGRATION.lower()
print("PASS: subscription intent uses RC435 claim, RC439 AES-GCM fields, and RC529 atomic correlation finalizer.")
print("LIMIT: static source contract only; disposable PostgreSQL and Paymob sandbox tests remain required.")
