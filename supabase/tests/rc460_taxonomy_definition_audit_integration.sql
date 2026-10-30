-- RC460 taxonomy definition audit integration. Disposable PostgreSQL only.
do $test$
declare
  admin_id constant uuid := '46000000-0000-4000-8000-000000000001';
  outsider_id constant uuid := '46000000-0000-4000-8000-000000000002';
  before_count integer;
  audit_id uuid;
  insert_audit_id uuid;
  delete_audit_id uuid;
  rejected boolean;
begin
  insert into auth.users(id) values (admin_id),(outsider_id);
  insert into public.user_memberships(id,user_id,tenant_id,role,status,permissions)
  values (
    '46000000-0000-4000-8000-000000000101',
    admin_id,'MNTY-PLATFORM','SUPER_ADMIN','ACTIVE',
    '{"scope":"PLATFORM","full_control":true}'::jsonb
  );

  -- A spoofed updated_by without the active platform-wide membership must abort the source write.
  rejected := false;
  begin
    insert into public.bizcatalog_platform_settings(settings_key,settings,updated_by)
    values (
      'bizcatalog',
      '{"categories":[{"id":"cat_food_grocery_fake","name":"Fake"}]}'::jsonb,
      outsider_id
    );
    raise exception 'RC460_UNAUTHORIZED_SETTINGS_WRITE_SUCCEEDED';
  exception when others then
    if sqlerrm <> 'PLATFORM_ADMIN_REQUIRED_FOR_TAXONOMY_AUDIT' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC460_UNAUTHORIZED_ACTOR_NOT_REJECTED'; end if;
  if exists(select 1 from public.bizcatalog_platform_settings where settings_key='bizcatalog') then
    raise exception 'RC460_UNAUTHORIZED_SETTINGS_ROW_PERSISTED';
  end if;

  insert into public.bizcatalog_platform_settings(settings_key,settings,updated_by)
  values (
    'bizcatalog',
    '{"categories":[{"id":"cat_food_grocery_cafes","name":"Cafes"}],"functionalGroups":[{"id":"food_grocery","name":"Food"}],"defaultCategories":["Food"]}'::jsonb,
    admin_id
  );

  select count(*) into before_count from public.catalog_taxonomy_definition_audit;
  if before_count <> 1 then
    raise exception 'RC460_INSERT_DEFINITION_AUDIT_MISSING: %',before_count;
  end if;

  select id into insert_audit_id
  from public.catalog_taxonomy_definition_audit
  where actor_user_id = admin_id and operation = 'INSERT'
  limit 1;
  if insert_audit_id is null then
    raise exception 'RC460_INSERT_DEFINITION_AUDIT_ID_MISSING';
  end if;

  -- Non-taxonomy setting changes must not create taxonomy audit noise.
  update public.bizcatalog_platform_settings
  set settings = settings || '{"adminWhatsApp":"+201000000000"}'::jsonb,
      updated_at = now() + interval '1 second'
  where settings_key = 'bizcatalog';
  if (select count(*) from public.catalog_taxonomy_definition_audit) <> before_count then
    raise exception 'RC460_NON_TAXONOMY_CHANGE_WAS_AUDITED';
  end if;

  -- Taxonomy definition changes must be recorded atomically.
  update public.bizcatalog_platform_settings
  set settings = jsonb_set(
        settings,
        '{categories}',
        '[{"id":"cat_food_grocery_cafes","name":"Specialty Cafes"},{"id":"cat_food_grocery_bakeries","name":"Bakeries"}]'::jsonb,
        true
      ),
      updated_by = admin_id,
      updated_at = now() + interval '2 seconds'
  where settings_key = 'bizcatalog';

  select id into audit_id
  from public.catalog_taxonomy_definition_audit
  where id <> insert_audit_id
    and operation = 'UPDATE'
  limit 1;

  if audit_id is null
     or (select actor_user_id from public.catalog_taxonomy_definition_audit where id=audit_id) <> admin_id
     or (select operation from public.catalog_taxonomy_definition_audit where id=audit_id) <> 'UPDATE'
     or (select before_taxonomy->'categories' from public.catalog_taxonomy_definition_audit where id=audit_id)
        <> '[{"id":"cat_food_grocery_cafes","name":"Cafes"}]'::jsonb
     or (select jsonb_array_length(after_taxonomy->'categories') from public.catalog_taxonomy_definition_audit where id=audit_id) <> 2 then
    raise exception 'RC460_TAXONOMY_UPDATE_AUDIT_INVALID';
  end if;

  -- Deleting a category is represented by an UPDATE snapshot that explicitly shows the removed entry.
  update public.bizcatalog_platform_settings
  set settings = jsonb_set(
        settings,
        '{categories}',
        '[{"id":"cat_food_grocery_cafes","name":"Specialty Cafes"}]'::jsonb,
        true
      ),
      updated_by = admin_id,
      updated_at = now() + interval '3 seconds'
  where settings_key = 'bizcatalog';

  select id into delete_audit_id
  from public.catalog_taxonomy_definition_audit
  where id <> insert_audit_id and id <> audit_id and operation = 'UPDATE'
  limit 1;

  if delete_audit_id is null
     or jsonb_array_length((select before_taxonomy->'categories' from public.catalog_taxonomy_definition_audit where id=delete_audit_id)) <> 2
     or jsonb_array_length((select after_taxonomy->'categories' from public.catalog_taxonomy_definition_audit where id=delete_audit_id)) <> 1 then
    raise exception 'RC460_TAXONOMY_DELETE_AUDIT_INVALID';
  end if;


  -- The audit is append-only.
  rejected := false;
  begin
    update public.catalog_taxonomy_definition_audit
    set after_taxonomy='{}'::jsonb where id=audit_id;
    raise exception 'RC460_AUDIT_UPDATE_SUCCEEDED';
  exception when others then
    if sqlerrm <> 'CATALOG_TAXONOMY_DEFINITION_AUDIT_APPEND_ONLY' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC460_AUDIT_UPDATE_NOT_REJECTED'; end if;

  rejected := false;
  begin
    delete from public.catalog_taxonomy_definition_audit where id=audit_id;
    raise exception 'RC460_AUDIT_DELETE_SUCCEEDED';
  exception when others then
    if sqlerrm <> 'CATALOG_TAXONOMY_DEFINITION_AUDIT_APPEND_ONLY' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC460_AUDIT_DELETE_NOT_REJECTED'; end if;

  -- A failed audit insert must abort the originating settings update too.
  create temporary table rc460_force_audit_failure(enabled boolean not null);
  insert into rc460_force_audit_failure values (true);
  execute $ddl$
    create function pg_temp.rc460_fail_audit_insert()
    returns trigger language plpgsql as $fn$
    begin
      if exists(select 1 from rc460_force_audit_failure where enabled) then
        raise exception 'RC460_FORCED_AUDIT_FAILURE';
      end if;
      return new;
    end;
    $fn$
  $ddl$;
  execute 'create trigger rc460_force_audit_failure before insert on public.catalog_taxonomy_definition_audit for each row execute function pg_temp.rc460_fail_audit_insert()';

  rejected := false;
  begin
    update public.bizcatalog_platform_settings
    set settings = jsonb_set(settings,'{defaultCategories}','["Changed"]'::jsonb,true),
        updated_by = admin_id
    where settings_key = 'bizcatalog';
    raise exception 'RC460_SETTINGS_UPDATE_SURVIVED_AUDIT_FAILURE';
  exception when others then
    if sqlerrm <> 'RC460_FORCED_AUDIT_FAILURE' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC460_AUDIT_FAILURE_NOT_PROPAGATED'; end if;
  if (select settings->'defaultCategories' from public.bizcatalog_platform_settings where settings_key='bizcatalog')
     <> '["Food"]'::jsonb then
    raise exception 'RC460_SETTINGS_PARTIALLY_UPDATED';
  end if;

end;
$test$;

select 'RC460 taxonomy definition audit integration: PASS' as result;
