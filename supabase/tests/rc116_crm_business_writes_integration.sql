-- RC116 write-path regression tests; run only against the disposable fixture.
set role authenticated;
do $test$
declare
  provider_a uuid := '30000000-0000-4000-8000-000000000011';
  provider_a2 uuid := '30000000-0000-4000-8000-000000000012';
  provider_b uuid := '30000000-0000-4000-8000-000000000013';
  legacy_owner uuid := '30000000-0000-4000-8000-000000000021';
  tenant_admin_no_business uuid := '30000000-0000-4000-8000-000000000014';
  affected integer;
begin
  -- A provider may create a lead only for a business with its own active membership.
  perform set_config('request.jwt.claim.sub', provider_a::text, false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_a::text, 'is_anonymous', false)::text, false);
  insert into public.marketing_leads(id, requester_user_id, requester_business_id, title)
  values ('50000000-0000-4000-8000-000000000001', provider_a,
          '30000000-0000-4000-8000-000000000001', 'Own business lead');

  -- Personal leads remain valid without a business association.
  insert into public.marketing_leads(id, requester_user_id, requester_business_id, title)
  values ('50000000-0000-4000-8000-000000000002', provider_a, null, 'Personal lead');

  -- Another business in the same tenant is still a different authorization scope.
  begin
    insert into public.marketing_leads(id, requester_user_id, requester_business_id, title)
    values ('50000000-0000-4000-8000-000000000003', provider_a,
            '30000000-0000-4000-8000-000000000002', 'Same tenant spoof');
    raise exception 'provider inserted a lead for a different business in the same tenant';
  exception when insufficient_privilege then
    null;
  end;

  -- Cross-tenant targeting is denied.
  begin
    insert into public.marketing_leads(id, requester_user_id, requester_business_id, title)
    values ('50000000-0000-4000-8000-000000000004', provider_a,
            '30000000-0000-4000-8000-000000000003', 'Cross tenant spoof');
    raise exception 'provider inserted a lead for another tenant';
  exception when insufficient_privilege then
    null;
  end;

  -- The actor cannot spoof a different requester identity.
  begin
    insert into public.marketing_leads(id, requester_user_id, requester_business_id, title)
    values ('50000000-0000-4000-8000-000000000005', provider_b,
            '30000000-0000-4000-8000-000000000001', 'Requester spoof');
    raise exception 'provider spoofed the lead requester identity';
  exception when insufficient_privilege then
    null;
  end;

  -- Only the canonical Edge Function's initial state/source is permitted to direct inserts.
  begin
    insert into public.marketing_leads(id, requester_user_id, requester_business_id, title, status)
    values ('50000000-0000-4000-8000-000000000006', provider_a,
            '30000000-0000-4000-8000-000000000001', 'Status spoof', 'MATCHED');
    raise exception 'provider inserted a pre-matched lead';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.marketing_leads(id, requester_user_id, requester_business_id, title, source)
    values ('50000000-0000-4000-8000-000000000007', provider_a,
            '30000000-0000-4000-8000-000000000001', 'Source spoof', 'PARTNER_REFERRAL');
    raise exception 'provider spoofed lead attribution source';
  exception when insufficient_privilege then
    null;
  end;

  -- A tenant-level admin with no concrete business membership cannot create
  -- a business-scoped lead through the direct table API.
  perform set_config('request.jwt.claim.sub', tenant_admin_no_business::text, false);
  begin
    insert into public.marketing_leads(id, requester_user_id, requester_business_id, title)
    values ('50000000-0000-4000-8000-000000000008', tenant_admin_no_business,
            '30000000-0000-4000-8000-000000000001', 'Unscoped tenant admin');
    raise exception 'unscoped tenant admin created a business lead without a business membership';
  exception when insufficient_privilege then
    null;
  end;

  -- Anonymous Auth sessions cannot use the authenticated Postgres role to create leads.
  perform set_config('request.jwt.claim.sub', provider_a::text, false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_a::text, 'is_anonymous', true)::text, false);
  begin
    insert into public.marketing_leads(id, requester_user_id, requester_business_id, title)
    values ('50000000-0000-4000-8000-000000000009', provider_a, null, 'Anonymous personal lead');
    raise exception 'anonymous session created a marketing lead';
  exception when insufficient_privilege then
    null;
  end;

  -- Confirmed provider owners can update only the two branding fields used by the UI.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_a::text, 'is_anonymous', false)::text, false);
  update public.marketing_provider_profiles
     set profile_image_path = 'users/provider-a/profile.webp',
         settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{branding}',
           coalesce(settings->'branding', '{}'::jsonb)
             || jsonb_build_object('logo_path', 'users/provider-a/logo.webp'),
           true
         ),
         updated_at = now()
   where id = '40000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'provider owner could not update own branding';
  end if;

  if not exists (
    select 1
    from public.marketing_provider_profiles
    where id = '40000000-0000-4000-8000-000000000001'
      and settings->>'official_showcase' = 'true'
      and settings->>'managed_by' = 'SUPER_ADMIN'
      and settings->>'activity_code' = 'HEALTH'
      and settings->'branding'->>'logo_path' = 'users/provider-a/logo.webp'
      and settings->'branding'->>'preserve_me' = 'platform-owned'
  ) then
    raise exception 'owner logo update changed non-brand profile settings';
  end if;

  -- An owner cannot move a profile to another business.
  begin
    update public.marketing_provider_profiles
       set business_id = '30000000-0000-4000-8000-000000000002'
     where id = '40000000-0000-4000-8000-000000000001';
    raise exception 'provider owner changed profile business_id';
  exception when insufficient_privilege then
    null;
  end;

  -- An owner cannot self-approve or change trust/ranking fields.
  begin
    update public.marketing_provider_profiles
       set status = 'ACTIVE'
     where id = '40000000-0000-4000-8000-000000000001';
    raise exception 'provider owner self-approved profile';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.marketing_provider_profiles
       set is_verified = true
     where id = '40000000-0000-4000-8000-000000000001';
    raise exception 'provider owner self-verified profile';
  exception when insufficient_privilege then
    null;
  end;

  -- Owners cannot directly insert or delete provider profiles; onboarding/admin
  -- workflows are the trusted creation and retirement paths.
  begin
    insert into public.marketing_provider_profiles(
      id, business_id, owner_user_id, provider_kind, name_ar, slug
    ) values (
      '40000000-0000-4000-8000-000000000003',
      '30000000-0000-4000-8000-000000000001',
      provider_a, 'FREELANCER', 'Spoof profile', 'spoof-profile'
    );
    raise exception 'provider owner directly inserted a provider profile';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.marketing_provider_profiles
     where id = '40000000-0000-4000-8000-000000000001';
    raise exception 'provider owner deleted provider profile';
  exception when insufficient_privilege then
    null;
  end;

  -- Legacy profiles without a business association retain owner-only branding access.
  -- No membership is needed for this legacy row, but business linkage remains immutable.
  perform set_config('request.jwt.claim.sub', legacy_owner::text, false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', legacy_owner::text, 'is_anonymous', false)::text, false);
  update public.marketing_provider_profiles
     set settings = jsonb_set(
           coalesce(settings, '{}'::jsonb),
           '{branding}',
           coalesce(settings->'branding', '{}'::jsonb)
             || jsonb_build_object('logo_path', 'users/legacy-owner/logo.webp'),
           true
         ),
         updated_at = now()
   where id = '40000000-0000-4000-8000-000000000004';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'legacy owner could not update branding on unassigned profile';
  end if;

  if not exists (
    select 1 from public.marketing_provider_profiles
     where id = '40000000-0000-4000-8000-000000000004'
       and owner_user_id = legacy_owner
       and business_id is null
       and settings->>'managed_by' = 'PLATFORM'
       and settings->'branding'->>'logo_path' = 'users/legacy-owner/logo.webp'
  ) then
    raise exception 'legacy owner profile branding update did not persist';
  end if;

  begin
    update public.marketing_provider_profiles
       set business_id = '30000000-0000-4000-8000-000000000001'
     where id = '40000000-0000-4000-8000-000000000004';
    raise exception 'legacy owner attached unassigned provider profile to a business';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.marketing_provider_profiles
       set status = 'ACTIVE'
     where id = '40000000-0000-4000-8000-000000000004';
    raise exception 'legacy owner changed profile approval state';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.marketing_provider_profiles
     where id = '40000000-0000-4000-8000-000000000004';
    raise exception 'legacy owner deleted unassigned provider profile';
  exception when insufficient_privilege then
    null;
  end;

  -- A second provider cannot modify the first provider's profile.
  perform set_config('request.jwt.claim.sub', provider_b::text, false);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', provider_b::text, 'is_anonymous', false)::text, false);
  update public.marketing_provider_profiles
     set profile_image_path = 'users/provider-b/stolen.webp'
   where id = '40000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'second provider modified another provider profile';
  end if;

  -- Profile ownership read remains available to the owner but not to a different provider.
  perform set_config('request.jwt.claim.sub', provider_a::text, false);
  if not exists (
    select 1 from public.marketing_provider_profiles
    where id = '40000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'provider owner lost own profile read';
  end if;
  perform set_config('request.jwt.claim.sub', provider_b::text, false);
  if exists (
    select 1 from public.marketing_provider_profiles
    where id = '40000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'second provider read another provider pending profile';
  end if;
end;
$test$;
reset role;
select 'RC116 CRM business-scoped write integration: PASS' as result;
