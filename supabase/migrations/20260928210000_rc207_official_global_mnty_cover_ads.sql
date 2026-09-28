-- RC207: official global MNTY cover advertisements
create table if not exists public.platform_global_advertisements (
 id uuid primary key default gen_random_uuid(),
 title varchar(180) not null,
 creative_url text not null,
 target_url text,
 ad_space_id varchar not null default 'HOME_SPONSORED',
 status varchar(30) not null default 'ACTIVE' check(status in('ACTIVE','INACTIVE')),
 approval_status varchar(30) not null default 'APPROVED' check(approval_status in('PENDING','APPROVED','REJECTED')),
 start_at timestamptz,end_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.platform_global_advertisements enable row level security;
alter table public.platform_global_advertisements force row level security;
revoke all on public.platform_global_advertisements from anon,authenticated;
grant all on public.platform_global_advertisements to service_role;
create index if not exists idx_global_ads_active_space on public.platform_global_advertisements(status,approval_status,ad_space_id,start_at,end_at);

create or replace function public.admin_create_global_ad(p_title varchar,p_creative_url text,p_target_url text default null,p_start_at timestamptz default null,p_end_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and upper(m.role) in('SUPER_ADMIN','ADMIN','OWNER')) then raise exception 'ADMIN_REQUIRED'; end if;
 if coalesce(trim(p_title),'')='' or coalesce(trim(p_creative_url),'')='' then raise exception 'TITLE_AND_CREATIVE_REQUIRED'; end if;
 insert into public.platform_global_advertisements(title,creative_url,target_url,status,approval_status,start_at,end_at,created_by) values(trim(p_title),trim(p_creative_url),nullif(trim(p_target_url),''),'ACTIVE','APPROVED',p_start_at,p_end_at,auth.uid()) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.admin_create_global_ad(varchar,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_create_global_ad(varchar,text,text,timestamptz,timestamptz) to authenticated;

-- The public delivery RPC is extended in the production migration to prefer geographic ads and fall back to these global official ads.
insert into public.platform_global_advertisements(title,creative_url,target_url,status,approval_status)
select 'حوّل نشاطك إلى عملاء جدد','https://islamnagy2022-eng.github.io/MantiqatiX/assets/mnty-cover-ad-1.svg','https://islamnagy2022-eng.github.io/MantiqatiX/','ACTIVE','APPROVED'
where not exists(select 1 from public.platform_global_advertisements where title='حوّل نشاطك إلى عملاء جدد');
insert into public.platform_global_advertisements(title,creative_url,target_url,status,approval_status)
select 'سجّل نشاطك على MNTY','https://islamnagy2022-eng.github.io/MantiqatiX/assets/mnty-cover-ad-2.svg','https://islamnagy2022-eng.github.io/MantiqatiX/','ACTIVE','APPROVED'
where not exists(select 1 from public.platform_global_advertisements where title='سجّل نشاطك على MNTY');
insert into public.platform_global_advertisements(title,creative_url,target_url,status,approval_status)
select 'فرصتك تبدأ هنا','https://islamnagy2022-eng.github.io/MantiqatiX/assets/mnty-cover-ad-3.svg','https://islamnagy2022-eng.github.io/MantiqatiX/','ACTIVE','APPROVED'
where not exists(select 1 from public.platform_global_advertisements where title='فرصتك تبدأ هنا');