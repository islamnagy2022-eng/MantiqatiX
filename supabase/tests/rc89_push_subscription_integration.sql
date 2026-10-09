-- RC89 behavioral integration test. Run only in disposable PostgreSQL.
do $test$
declare
  user_a uuid := '20000000-0000-4000-8000-000000000001';
  user_b uuid := '20000000-0000-4000-8000-000000000002';
  v_row public.push_subscriptions%rowtype;
  rejected boolean;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', user_a::text, false);
  select * into v_row
  from private.upsert_mnty_push_subscription(
    'https://push.example.test/endpoint-user-a-123456',
    'p256dh-user-a-key-material-123456789',
    'auth-user-a-key-123456789',
    'test-agent-a',
    'web'
  );
  if v_row.user_id <> user_a or v_row.p256dh <> 'p256dh-user-a-key-material-123456789' then
    raise exception 'new endpoint registration failed';
  end if;

  -- Same-owner refresh is allowed and updates keys without changing ownership.
  select * into v_row
  from private.upsert_mnty_push_subscription(
    'https://push.example.test/endpoint-user-a-123456',
    'p256dh-user-a-refreshed-key-123456',
    'auth-user-a-refreshed-123456',
    'test-agent-a2',
    'web'
  );
  if v_row.user_id <> user_a
     or v_row.p256dh <> 'p256dh-user-a-refreshed-key-123456'
     or v_row.auth <> 'auth-user-a-refreshed-123456' then
    raise exception 'same-owner refresh failed';
  end if;

  -- A different authenticated user must fail closed on the same endpoint.
  perform pg_catalog.set_config('request.jwt.claim.sub', user_b::text, false);
  rejected := false;
  begin
    perform private.upsert_mnty_push_subscription(
      'https://push.example.test/endpoint-user-a-123456',
      'attacker-p256dh-key-material-123456',
      'attacker-auth-key-123456',
      'attacker-agent',
      'mobile'
    );
    raise exception 'TEST_FAILED: cross-user endpoint takeover unexpectedly succeeded';
  exception when sqlstate '42501' then
    if sqlerrm <> 'PUSH_ENDPOINT_OWNERSHIP_CONFLICT' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'cross-user endpoint takeover was not rejected'; end if;

  select * into v_row from public.push_subscriptions
  where endpoint = 'https://push.example.test/endpoint-user-a-123456';
  if v_row.user_id <> user_a
     or v_row.p256dh <> 'p256dh-user-a-refreshed-key-123456'
     or v_row.auth <> 'auth-user-a-refreshed-123456'
     or v_row.user_agent <> 'test-agent-a2' then
    raise exception 'rejected takeover changed original owner or subscription keys';
  end if;

  -- Unauthenticated registration must fail before touching the table.
  perform pg_catalog.set_config('request.jwt.claim.sub', '', false);
  rejected := false;
  begin
    perform private.upsert_mnty_push_subscription(
      'https://push.example.test/endpoint-anonymous-123456',
      'anonymous-p256dh-key-material-123456',
      'anonymous-auth-key-123456',
      'anonymous-agent',
      'web'
    );
    raise exception 'TEST_FAILED: unauthenticated registration unexpectedly succeeded';
  exception when sqlstate '28000' then
    if sqlerrm <> 'AUTH_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'unauthenticated registration was not rejected'; end if;

  -- A different user can register a genuinely new endpoint.
  perform pg_catalog.set_config('request.jwt.claim.sub', user_b::text, false);
  select * into v_row
  from private.upsert_mnty_push_subscription(
    'https://push.example.test/endpoint-user-b-123456',
    'p256dh-user-b-key-material-123456',
    'auth-user-b-key-123456',
    'test-agent-b',
    'web'
  );
  if v_row.user_id <> user_b then raise exception 'new endpoint for second user failed'; end if;
end;
$test$;

select 'RC89 push subscription ownership integration: PASS' as result;
