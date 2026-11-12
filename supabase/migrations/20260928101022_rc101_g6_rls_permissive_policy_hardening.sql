-- RC101 G6: remove permissive generic ALL policies that weakened scoped RLS.
drop policy if exists authenticated_sessions_only on public.indrive_requests;
drop policy if exists mnt_non_anonymous_boundary on public.indrive_requests;
drop policy if exists non_anonymous_authenticated_guard on public.indrive_requests;

drop policy if exists authenticated_sessions_only on public.indrive_bids;
drop policy if exists mnt_non_anonymous_boundary on public.indrive_bids;
drop policy if exists non_anonymous_authenticated_guard on public.indrive_bids;

drop policy if exists authenticated_sessions_only on public.marketing_leads;
drop policy if exists mnt_non_anonymous_boundary on public.marketing_leads;
drop policy if exists non_anonymous_authenticated_guard on public.marketing_leads;

drop policy if exists authenticated_sessions_only on public.marketing_projects;
drop policy if exists mnt_non_anonymous_boundary on public.marketing_projects;
drop policy if exists non_anonymous_authenticated_guard on public.marketing_projects;
