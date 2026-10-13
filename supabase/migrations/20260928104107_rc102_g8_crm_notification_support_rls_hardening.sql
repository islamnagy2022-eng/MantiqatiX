-- RC102 G8: remove legacy broad authenticated ALL policies from CRM/support notification tables.
drop policy if exists authenticated_sessions_only on public.notifications;
drop policy if exists mnt_non_anonymous_boundary on public.notifications;
drop policy if exists non_anonymous_authenticated_guard on public.notifications;
drop policy if exists non_anonymous_authenticated_only on public.notifications;

drop policy if exists authenticated_sessions_only on public.support_tickets;
drop policy if exists mnt_non_anonymous_boundary on public.support_tickets;
drop policy if exists non_anonymous_authenticated_guard on public.support_tickets;

drop policy if exists authenticated_sessions_only on public.ticket_messages;
drop policy if exists mnt_non_anonymous_boundary on public.ticket_messages;
drop policy if exists non_anonymous_authenticated_guard on public.ticket_messages;
