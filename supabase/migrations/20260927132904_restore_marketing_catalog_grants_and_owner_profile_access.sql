-- Restore the grants required by PostgREST/Supabase client calls.
-- RLS remains the authorization boundary.
grant select on public.marketing_provider_profiles to anon, authenticated;
grant insert, update, delete on public.marketing_provider_profiles to authenticated;
grant select on public.marketing_provider_services to anon, authenticated;
grant select on public.marketing_services to anon, authenticated;

-- Remove legacy permissive authenticated policies from the provider profile table.
drop policy if exists "authenticated_sessions_only" on public.marketing_provider_profiles;
drop policy if exists "mnt_non_anonymous_boundary" on public.marketing_provider_profiles;
drop policy if exists "non_anonymous_authenticated_guard" on public.marketing_provider_profiles;

-- Keep only public active-catalog read and owner-authorized management.
drop policy if exists "Owners manage their marketing provider profile" on public.marketing_provider_profiles;
create policy "Owners manage their marketing provider profile"
on public.marketing_provider_profiles
for all to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true'
  and auth.uid() = owner_user_id
)
with check (
  coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true'
  and auth.uid() = owner_user_id
);