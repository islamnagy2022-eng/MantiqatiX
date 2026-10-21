-- RC469 integration assertions; run after fixture and migration.
do $$
declare v jsonb; v_failed boolean;
begin
  -- A session without a JWT subject must fail closed even when it supplies a known captain id.
  perform set_config('request.jwt.claim.sub','',true);
  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend('00000000-0000-4000-8000-000000000001','OFFLINE',null,null);
  exception when others then
    v_failed:=sqlerrm='USER_CONTEXT_MISMATCH';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: null auth identity was accepted'; end if;

  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend(auth.uid(),'OFFLINE',30.1,null);
  exception when others then
    v_failed:=sqlerrm='INVALID_COORDINATE_PAIR';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: partial coordinate update was accepted'; end if;

  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend(auth.uid(),'OFFLINE',null,31.2);
  exception when others then
    v_failed:=sqlerrm='INVALID_COORDINATE_PAIR';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: longitude-only coordinate update was accepted'; end if;

  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend(auth.uid(),'AVAILABLE',null,null);
  exception when others then
    v_failed:=sqlerrm='CAPTAIN_LOCATION_REQUIRED_FOR_AVAILABILITY';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: missing coordinates were accepted'; end if;

  select public.update_mantigo_captain_presence_backend(auth.uid(),'AVAILABLE',30.1,31.2) into v;
  if v->>'availability_status'<>'AVAILABLE' then raise exception 'RC469_TEST_FAILED: valid captain did not become available'; end if;

  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend(auth.uid(),'AVAILABLE',30.1,31.2);
  exception when others then
    v_failed:=sqlerrm='CAPTAIN_NOT_VERIFIED_FOR_AVAILABILITY';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: unverified captain was accepted'; end if;

  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend(auth.uid(),'AVAILABLE',30.1,31.2);
  exception when others then
    v_failed:=sqlerrm='CAPTAIN_NOT_VERIFIED_FOR_AVAILABILITY';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: null status was not rejected'; end if;

  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend(auth.uid(),null,30.1,31.2);
  exception when others then
    v_failed:=sqlerrm='INVALID_AVAILABILITY_STATUS';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: null availability was accepted'; end if;

  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend(auth.uid(),'AVAILABLE',30.1,31.2);
  exception when others then
    v_failed:=sqlerrm='CAPTAIN_PROFILE_NOT_FOUND';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: missing captain profile was accepted'; end if;

  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend('00000000-0000-4000-8000-000000000002','OFFLINE',null,null);
  exception when others then
    v_failed:=sqlerrm='USER_CONTEXT_MISMATCH';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: mismatched actor was accepted'; end if;

  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend(auth.uid(),'AVAILABLE',91,31.2);
  exception when others then
    v_failed:=sqlerrm='INVALID_LATITUDE';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: out-of-range latitude was accepted'; end if;

  v_failed:=false;
  begin
    perform public.update_mantigo_captain_presence_backend(auth.uid(),'AVAILABLE',30.1,181);
  exception when others then
    v_failed:=sqlerrm='INVALID_LONGITUDE';
  end;
  if not v_failed then raise exception 'RC469_TEST_FAILED: out-of-range longitude was accepted'; end if;

  if has_function_privilege('anon','public.update_mantigo_captain_presence_backend(uuid,text,double precision,double precision)','EXECUTE') then
    raise exception 'RC469_TEST_FAILED: anon can execute presence RPC';
  end if;
  if not has_function_privilege('authenticated','public.update_mantigo_captain_presence_backend(uuid,text,double precision,double precision)','EXECUTE') then
    raise exception 'RC469_TEST_FAILED: authenticated cannot execute presence RPC';
  end if;

  -- A verified captain may explicitly go offline without supplying fresh coordinates.
  select public.update_mantigo_captain_presence_backend(auth.uid(),'OFFLINE',null,null) into v;
  if v->>'availability_status'<>'OFFLINE' then
    raise exception 'RC469_TEST_FAILED: offline transition unexpectedly failed';
  end if;
  if not exists (
    select 1 from public.mantigo_captain_profiles
    where captain_id=auth.uid() and current_lat=30.1 and current_lon=31.2
  ) then
    raise exception 'RC469_TEST_FAILED: offline transition unexpectedly erased last known coordinates';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where actor_user_id=auth.uid()
      and action='MANTIGO_CAPTAIN_PRESENCE_UPDATED'
      and new_values->>'availability_status'='OFFLINE'
      and new_values->>'has_coordinates'='true'
  ) then
    raise exception 'RC469_TEST_FAILED: audit did not record retained coordinates accurately';
  end if;

  raise notice 'RC469_PRESENCE_GUARD_INTEGRATION: PASS';
end $$;
