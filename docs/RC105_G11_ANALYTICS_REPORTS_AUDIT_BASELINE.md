# RC105 — G11 Analytics, Reports & Auditability Baseline

Date: 2026-09-28

## Scope

Reviewed the live Supabase schema for analytics/report/audit-related data and the current production source.

## Findings

### Analytics / reports
No public table with a direct analytics/report name was found in the live schema query.
Existing event/reporting sources include:
- audit_logs
- consent_audit_log
- payment_events
- payment_provider_events
- business_referral_events
- referral_events
- smm_order_events
- sync_logs

Conclusion: do not create a parallel analytics truth until the reporting requirements are mapped to authoritative operational tables/events.

### Audit logs
audit_logs is RLS-enabled and FORCE RLS.
The table contains tenant, actor, action, entity, old_values, new_values, result, IP, user-agent and timestamp fields.

Security issue found:
- Previous SELECT scope allowed any active tenant member to read the tenant audit trail.
- This was broader than the security/audit role intent and could expose audit payloads to customers/providers/staff.

Fix applied in production:
- Removed audit_logs_select_tenant.
- Added audit_logs_select_admin_scope.
- SELECT is now restricted to active same-tenant roles:
  OWNER, BUSINESS_OWNER, ADMIN, MANAGER.
- Existing non-anonymous restrictive boundaries remain.
- Backend-authoritative insert privilege remains governed separately; authenticated direct INSERT privilege had already been revoked by the earlier sensitive-write hardening.

## Verification

Production DB query confirms:
- audit_logs RLS enabled.
- FORCE RLS enabled.
- audit_logs_select_admin_scope exists.
- SELECT predicate checks same tenant, ACTIVE membership and the four administrative roles.

## Remaining G11 TODO

- E2E prove CUSTOMER/SERVICE_PROVIDER/STAFF cannot read audit logs.
- E2E prove authorized owner/admin/manager can read only same-tenant logs.
- Verify append-only behavior from actual database privileges and production paths.
- Review whether old_values/new_values, IP and user-agent need retention/redaction controls.
- Review integrity/hash requirement. Older project documentation references an integrity hash, but the current audit_logs schema inspected in production has no integrity-hash column.
- Map all critical operations that must emit server-side audit records.
- Build reports/drill-downs only from authoritative sources.
- Add monitoring/alerting for audit write failures if required by the final operations model.

## Status

Implementation: COMPLETE for the identified G11 audit-read scope issue.
DB verification: COMPLETE.
Analytics/report implementation: NOT COMPLETE.
E2E: NOT VERIFIED.
Release gate: OPEN.
