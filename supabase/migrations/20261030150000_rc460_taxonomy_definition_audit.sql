-- RC460: immutable audit trail for taxonomy definition changes in platform settings.
-- Trigger-based so the settings mutation and its audit event commit or roll back together.

create table if not exists public.catalog_taxonomy_definition_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  settings_key text not null,
  operation text not null check (operation in ('INSERT','UPDATE')),
  before_taxonomy jsonb not null,
  after_taxonomy jsonb not null,
  changed_at timestamptz not null default now()
);

alter table public.catalog_taxonomy_definition_audit enable row level security;
alter table public.catalog_taxonomy_definition_audit force row level security;
revoke all on table public.catalog_taxonomy_definition_audit from public, anon, authenticated, service_role;

create or replace function public.audit_catalog_taxonomy_definition_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_actor uuid;
begin
  if new.settings_key <> 'bizcatalog' then
    return new;
  end if;

  v_actor := new.updated_by;
  if v_actor is null then
    -- Non-user bootstrap/seed writes do not impersonate a human actor.
    return new;
  end if;

  v_after := jsonb_build_object(
    'categories', coalesce(new.settings->'categories','null'::jsonb),
    'functionalGroups', coalesce(new.settings->'functionalGroups','null'::jsonb),
    'defaultCategories', coalesce(new.settings->'defaultCategories','null'::jsonb)
  );

  if tg_op = 'UPDATE' then
    v_before := jsonb_build_object(
      'categories', coalesce(old.settings->'categories','null'::jsonb),
      'functionalGroups', coalesce(old.settings->'functionalGroups','null'::jsonb),
      'defaultCategories', coalesce(old.settings->'defaultCategories','null'::jsonb)
    );
    if v_before = v_after then
      return new;
    end if;
  end if;

  insert into public.catalog_taxonomy_definition_audit (
    actor_user_id, settings_key, operation, before_taxonomy, after_taxonomy
  ) values (
    v_actor, new.settings_key, tg_op, v_before, v_after
  );

  return new;
end;
$function$;

revoke all on function public.audit_catalog_taxonomy_definition_change() from public, anon, authenticated, service_role;
drop trigger if exists bizcatalog_taxonomy_definition_audit on public.bizcatalog_platform_settings;
create trigger bizcatalog_taxonomy_definition_audit
after insert or update of settings, updated_by on public.bizcatalog_platform_settings
for each row execute function public.audit_catalog_taxonomy_definition_change();

create or replace function public.prevent_catalog_taxonomy_definition_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception 'CATALOG_TAXONOMY_DEFINITION_AUDIT_APPEND_ONLY';
end;
$function$;

revoke all on function public.prevent_catalog_taxonomy_definition_audit_mutation() from public, anon, authenticated, service_role;
drop trigger if exists catalog_taxonomy_definition_audit_append_only on public.catalog_taxonomy_definition_audit;
create trigger catalog_taxonomy_definition_audit_append_only
before update or delete on public.catalog_taxonomy_definition_audit
for each row execute function public.prevent_catalog_taxonomy_definition_audit_mutation();
