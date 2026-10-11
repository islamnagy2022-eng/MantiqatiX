-- RC439 database schema/constraint integration test; disposable PostgreSQL only.
do $test$
declare
  intent_id uuid := '30000000-0000-4000-8000-000000000009';
  business uuid := '20000000-0000-4000-8000-000000000001';
  actor uuid := '10000000-0000-4000-8000-000000000001';
  rejected boolean;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscription_payment_intents' and column_name='client_secret_ciphertext') then
    raise exception 'ciphertext column missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscription_payment_intents' and column_name='client_secret_iv') then
    raise exception 'IV column missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscription_payment_intents' and column_name='client_secret_key_version') then
    raise exception 'key version column missing';
  end if;

  insert into public.subscription_payment_intents(
    id,business_id,tier_code,billing_cycle,amount,currency,status,provider,idempotency_key,pricing_hash,created_by
  ) values(intent_id,business,'BASIC','MONTHLY',100,'EGP','PENDING','PAYMOB','rc439-key-0001','hash',actor);

  update public.subscription_payment_intents
  set client_secret_ciphertext='ciphertext-base64',client_secret_iv='iv-base64',client_secret_key_version='v1'
  where id=intent_id;
  if not exists(select 1 from public.subscription_payment_intents where id=intent_id and client_secret_ciphertext='ciphertext-base64' and client_secret_iv='iv-base64' and client_secret_key_version='v1') then
    raise exception 'complete encrypted secret tuple was not stored';
  end if;

  rejected:=false;
  begin
    update public.subscription_payment_intents set client_secret_iv=null where id=intent_id;
  exception when check_violation then rejected:=true;
  end;
  if not rejected then raise exception 'partial encrypted secret tuple must be rejected'; end if;

  update public.subscription_payment_intents
  set client_secret_ciphertext=null,client_secret_iv=null,client_secret_key_version=null
  where id=intent_id;
  if exists(select 1 from public.subscription_payment_intents where id=intent_id and (client_secret_ciphertext is not null or client_secret_iv is not null or client_secret_key_version is not null)) then
    raise exception 'all-null secret tuple should be valid';
  end if;
end;
$test$;
select 'RC439 checkout recovery schema integration: PASS' as result;
