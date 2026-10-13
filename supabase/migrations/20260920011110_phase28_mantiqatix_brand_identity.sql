create table if not exists public.platform_brand_identity (
    id uuid primary key default gen_random_uuid(),
    brand_key varchar(80) not null unique,
    brand_name_en varchar(120) not null,
    brand_name_ar varchar(120) not null,
    tagline_ar varchar(255) not null,
    logo_asset_ref varchar(255),
    app_icon_asset_ref varchar(255),
    primary_colors jsonb not null default '{}'::jsonb,
    typography jsonb not null default '{}'::jsonb,
    logo_usage jsonb not null default '{}'::jsonb,
    icon_sizes jsonb not null default '{}'::jsonb,
    status varchar(20) not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
    version varchar(30) not null default '1.0.0',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table public.platform_brand_identity enable row level security;

  drop policy if exists brand_identity_authenticated_read on public.platform_brand_identity;
  create policy brand_identity_authenticated_read
    on public.platform_brand_identity
    for select
    to authenticated
    using (true);

  drop policy if exists brand_identity_deny_anonymous on public.platform_brand_identity;
  create policy brand_identity_deny_anonymous
    on public.platform_brand_identity
    for all
    to authenticated
    using (coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
    with check (coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

  insert into public.platform_brand_identity (
    brand_key, brand_name_en, brand_name_ar, tagline_ar,
    logo_asset_ref, app_icon_asset_ref,
    primary_colors, typography, logo_usage, icon_sizes, version
  )
  values (
    'MANTIQATIX',
    'MANTIQATIX',
    'منطقي X',
    'منصة تسويقية متكاملة',
    'file_00000000bffc820aa4a466a3475cae22',
    'file_0000000091b8820a9769378730409b8c',
    jsonb_build_object(
      'blue','#2563EB',
      'turquoise','#00C896',
      'purple','#7C3AED',
      'orange','#FFB800',
      'dark','#101828',
      'light','#F5F7FA',
      'gradient','linear-gradient(90deg,#2563EB 0%,#00C896 48%,#7C3AED 100%)'
    ),
    jsonb_build_object(
      'arabic','Tajawal',
      'latin','Inter',
      'weights', jsonb_build_array('300','400','500','600','700')
    ),
    jsonb_build_object(
      'primary','full_lockup_on_light',
      'dark','full_lockup_on_dark',
      'compact','MX_mark_only',
      'app_icon','MX_on_dark_rounded_square',
      'rule','do_not_stretch_or_recolor'
    ),
    jsonb_build_object(
      '1024','1024px',
      '512','512px',
      '256','256px',
      '128','128px',
      '64','64px',
      '32','32px'
    ),
    '1.0.0'
  )
  on conflict (brand_key) do update set
    brand_name_en = excluded.brand_name_en,
    brand_name_ar = excluded.brand_name_ar,
    tagline_ar = excluded.tagline_ar,
    logo_asset_ref = excluded.logo_asset_ref,
    app_icon_asset_ref = excluded.app_icon_asset_ref,
    primary_colors = excluded.primary_colors,
    typography = excluded.typography,
    logo_usage = excluded.logo_usage,
    icon_sizes = excluded.icon_sizes,
    version = excluded.version,
    status = 'ACTIVE',
    updated_at = now();
