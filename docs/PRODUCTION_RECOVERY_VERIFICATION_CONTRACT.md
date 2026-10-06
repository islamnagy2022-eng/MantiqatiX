# Production Recovery Verification Contract

This is a read-only verification contract. It does not perform a restore and therefore cannot certify RPO/RTO.

## Live baseline checks
- PostgreSQL foreign-key constraints exist in the public schema.
- General ledger debit/credit balance must reconcile to zero difference.
- Journal and settlement statuses must be inspectable after restore.
- All public ordinary tables must have RLS enabled.
- Core MantiGO tables must retain RLS and deny direct client writes.

## Restore rehearsal evidence required before certification
1. Restore a production snapshot/PITR copy into an isolated recovery target.
2. Record restore timestamp and measured RTO.
3. Record last recoverable transaction timestamp and measured RPO.
4. Run the SQL checks in this contract against the restored target.
5. Run application smoke tests against the isolated target.
6. Run tenant-isolation and role-escalation tests.
7. Reconcile general ledger and settlement transactions.
8. Record rollback decision and evidence.

## Certification rule
A documented runbook is not proof of recoverability. Production certification remains blocked until a real restore rehearsal produces measured evidence.
