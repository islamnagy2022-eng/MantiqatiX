-- Prevent anonymous sessions from reading ad placement definitions.
drop policy if exists ad_spaces_authenticated_read on public.ad_spaces;
create policy ad_spaces_authenticated_read
  on public.ad_spaces
  for select
  to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');
