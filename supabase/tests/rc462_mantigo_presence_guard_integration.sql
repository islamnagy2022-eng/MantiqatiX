-- RC462 integration assertions; run after fixture and migration.
do $$
declare v jsonb; v_failed boolean;
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
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

  raise notice 'RC469_PRESENCE_GUARD_INTEGRATION: PASS';
end $$;
