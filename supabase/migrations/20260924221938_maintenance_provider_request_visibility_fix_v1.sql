
drop policy if exists indrive_requests_select on public.indrive_requests;
create policy indrive_requests_select on public.indrive_requests
for select
to authenticated
using (
  coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
  and (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.indrive_bids b
      where b.request_id = indrive_requests.id
        and b.provider_user_id = auth.uid()
        and b.status in ('OFFERED','ACCEPTED')
    )
    or public.is_platform_admin()
  )
);
