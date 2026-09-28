# RC102 — G8 CRM / Customer-Provider Separation Baseline

## Scope
G8 reviews CRM, customer/provider separation, notifications, and support access.

## Findings
### Customer leads
`marketing_leads` currently has:
- authenticated INSERT only when `requester_user_id = auth.uid()`;
- SELECT only for the requesting user.

This is an owner-scoped customer-lead boundary.

### Provider profiles
`marketing_provider_profiles` has:
- owner-scoped ALL policy for the profile owner;
- public/anonymous SELECT only for ACTIVE profiles.

### Notifications
The table had legacy broad authenticated `ALL` policies in addition to explicit self-scoped policies. Because permissive policies can broaden access, the legacy broad policies were removed.

The remaining verified policies are:
- INSERT: `user_id = auth.uid()`
- SELECT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`

### Support tickets
Legacy broad authenticated `ALL` policies were removed.

Remaining verified access:
- INSERT: requester must equal `auth.uid()` and have an ACTIVE membership in the ticket tenant.
- SELECT: requester, assigned user, or an active tenant member with an approved support/admin role.
- UPDATE: active tenant member with an approved support/admin role.

### Ticket messages
Legacy broad authenticated `ALL` policies were removed.

Remaining verified access:
- INSERT only when sender is the current user and the user is a valid participant/staff member on the referenced ticket.
- SELECT only through the referenced ticket's requester/assignee/approved support/admin scope.

## Production change
Migration applied successfully:
`rc102_g8_crm_notification_support_rls_hardening`

GitHub migration commit:
`96b51541ed1e48230b9ff371d14a62c34446c0a4`

## Not yet E2E verified
- two real customer accounts reading each other's notifications;
- customer vs provider support-ticket isolation;
- support staff cross-tenant isolation;
- real CRM lead lifecycle with separate customer/provider accounts;
- browser E2E for ticket messages and notifications.

## Release status
**G8 security boundary = implemented and database verified.**
**G8 full E2E = NOT VERIFIED.**
