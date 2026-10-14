-- RC439: recover an existing Paymob checkout without storing client_secret in plaintext.
alter table public.subscription_payment_intents
  add column if not exists client_secret_ciphertext text;
alter table public.subscription_payment_intents
  add column if not exists client_secret_iv text;
alter table public.subscription_payment_intents
  add column if not exists client_secret_key_version text;

do $constraint$
begin
  alter table public.subscription_payment_intents
    add constraint subscription_payment_intents_checkout_secret_ciphertext_check
    check (
      (client_secret_ciphertext is null and client_secret_iv is null and client_secret_key_version is null)
      or
      (client_secret_ciphertext is not null and client_secret_iv is not null and client_secret_key_version is not null)
    );
exception when duplicate_object then null;
end;
$constraint$;

comment on column public.subscription_payment_intents.client_secret_ciphertext is
  'RC439 AES-GCM ciphertext for the Paymob checkout client secret; never store plaintext. Decryption key lives only in Edge Function secrets.';
comment on column public.subscription_payment_intents.client_secret_iv is
  'RC439 per-secret random AES-GCM IV, base64 encoded.';
comment on column public.subscription_payment_intents.client_secret_key_version is
  'RC439 encryption key version identifier; retain old version keys during rotation.';
