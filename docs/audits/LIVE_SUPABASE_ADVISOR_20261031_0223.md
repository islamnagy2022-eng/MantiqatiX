# Live Supabase Advisor snapshot — 2026-10-31 02:23 UTC

## Scope and safety

Read-only retrieval of Supabase Security and Performance Advisor findings for project `moyhiluyhjsujhwlyeuu`. No database writes, policy/grant changes, Auth setting changes, index changes, or Edge Function changes were performed.

## Security Advisor

| Finding | Severity | Count |
|---|---:|---:|
| RLS enabled, no policy | INFO | 8 |
| SECURITY DEFINER executable by anon | WARN | 3 |
| SECURITY DEFINER executable by authenticated | WARN | 67 |
| Anonymous-sign-in-related policy findings | WARN | 90 |
| Leaked Password Protection | WARN | 1 |

Important interpretation:
- The 90 anonymous-sign-in findings are not 90 direct anonymous table grants. They are advisor findings associated with anonymous sign-in mode and policies whose role sets include anonymous/authenticated access. Review policy and actual role privileges individually.
- The 8 no-policy tables were previously inspected as deny-by-default/RPC-only; preserve this until exact grants and callers are rechecked. Do not add broad policies.
- The 3 anon-executable SECURITY DEFINER findings include two trigger-returning functions and one intentionally public targeted-ad discovery RPC; keep caller/trigger contracts distinct.
- Leaked Password Protection remains an open managed Auth setting; it was not changed in this read-only review.

## Performance Advisor

| Finding | Severity | Count |
|---|---:|---:|
| Unindexed foreign keys | INFO | 129 |
| Auth/RLS init-plan | WARN | 375 |
| Unused indexes | INFO | 73 |
| Multiple permissive policy groups | WARN | 28 |

Do not apply bulk index or policy rewrites from aggregate Advisor counts. Require query-plan/workload evidence, per-table access-path review, and RLS regression tests.

## Required next actions

1. Review SECURITY DEFINER function EXECUTE grants and caller paths one by one; do not mass revoke.
2. Confirm anonymous sign-in product intent before changing the Auth setting; test real sign-in, role and tenant flows.
3. Evaluate leaked-password protection through authorized Supabase Auth configuration and repeat the Advisor check.
4. Review FK indexes and RLS init-plan candidates with explain plans and realistic workloads.
5. Preserve migration freeze until a protected backup and disposable restore rehearsal exist.

## Release status

This snapshot is diagnostic only. It does not certify security or performance. Production remains **BLOCKED / NOT CERTIFIED**.
