create table if not exists public.digital_pages (
  id uuid primary key default gen_random_uuid(),
  page_type text not null check (page_type in ('PORTFOLIO','MENU')),
  business_id uuid references public.businesses(id) on delete set null,
  provider_profile_id uuid references public.marketing_provider_profiles(id) on delete set null,
  slug text not null unique,
  title text not null,
  subtitle text,
  description text,
  seo_title text,
  seo_description text,
  theme jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  version bigint not null default 1,
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (business_id is not null or provider_profile_id is not null)
);
create index if not exists digital_pages_public_idx on public.digital_pages(status,page_type);
create index if not exists digital_pages_business_idx on public.digital_pages(business_id);
create index if not exists digital_pages_provider_idx on public.digital_pages(provider_profile_id);
create table if not exists public.digital_page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.digital_pages(id) on delete cascade,
  section_type text not null check (section_type in ('HERO','ABOUT','SERVICES','MENU','PORTFOLIO','CONTACT','CTA','CUSTOM')),
  sort_order integer not null default 0,
  title text,
  content text,
  data jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists digital_page_sections_order_idx on public.digital_page_sections(page_id,sort_order,id);
alter table public.digital_pages enable row level security;
alter table public.digital_page_sections enable row level security;
drop policy if exists digital_pages_public_read on public.digital_pages;
create policy digital_pages_public_read on public.digital_pages for select to anon,authenticated using (status='PUBLISHED');
drop policy if exists digital_pages_owner_manage on public.digital_pages;
create policy digital_pages_owner_manage on public.digital_pages for all to authenticated using (
  (business_id is not null and exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.business_id=digital_pages.business_id and m.status='ACTIVE' and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')))
  or
  (provider_profile_id is not null and exists (select 1 from public.marketing_provider_profiles p where p.id=digital_pages.provider_profile_id and p.owner_user_id=auth.uid()))
) with check (
  (business_id is not null and exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.business_id=digital_pages.business_id and m.status='ACTIVE' and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')))
  or
  (provider_profile_id is not null and exists (select 1 from public.marketing_provider_profiles p where p.id=digital_pages.provider_profile_id and p.owner_user_id=auth.uid()))
);
drop policy if exists digital_page_sections_public_read on public.digital_page_sections;
create policy digital_page_sections_public_read on public.digital_page_sections for select to anon,authenticated using (active=true and exists (select 1 from public.digital_pages p where p.id=digital_page_sections.page_id and p.status='PUBLISHED'));
drop policy if exists digital_page_sections_owner_manage on public.digital_page_sections;
create policy digital_page_sections_owner_manage on public.digital_page_sections for all to authenticated using (
  exists (select 1 from public.digital_pages p where p.id=digital_page_sections.page_id and (
    (p.business_id is not null and exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.business_id=p.business_id and m.status='ACTIVE' and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')))
    or
    (p.provider_profile_id is not null and exists (select 1 from public.marketing_provider_profiles mp where mp.id=p.provider_profile_id and mp.owner_user_id=auth.uid()))
  ))
) with check (
  exists (select 1 from public.digital_pages p where p.id=digital_page_sections.page_id and (
    (p.business_id is not null and exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.business_id=p.business_id and m.status='ACTIVE' and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')))
    or
    (p.provider_profile_id is not null and exists (select 1 from public.marketing_provider_profiles mp where mp.id=p.provider_profile_id and mp.owner_user_id=auth.uid()))
  ))
);
revoke all on public.digital_pages from anon,authenticated;
grant select on public.digital_pages to anon,authenticated;
grant insert,update,delete on public.digital_pages to authenticated;
revoke all on public.digital_page_sections from anon,authenticated;
grant select on public.digital_page_sections to anon,authenticated;
grant insert,update,delete on public.digital_page_sections to authenticated;
create or replace function public.touch_digital_page_version() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  new.updated_at=now();
  if tg_op='UPDATE' then new.version=old.version+1; end if;
  if new.status='PUBLISHED' and old.status is distinct from 'PUBLISHED' then new.published_at=coalesce(new.published_at,now());
  elsif new.status<>'PUBLISHED' then new.published_at=null; end if;
  return new;
end; $$;
drop trigger if exists trg_digital_pages_touch on public.digital_pages;
create trigger trg_digital_pages_touch before update on public.digital_pages for each row execute function public.touch_digital_page_version();
create or replace function public.touch_digital_page_section() returns trigger language plpgsql security invoker set search_path=public as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_digital_page_sections_touch on public.digital_page_sections;
create trigger trg_digital_page_sections_touch before update on public.digital_page_sections for each row execute function public.touch_digital_page_section();