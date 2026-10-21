# Live Production Read-Only Audit — 2026-10-21

## Scope and method

Read-only inspection of the Supabase production project using migration metadata, PostgreSQL catalog queries, Edge Function inventory, and Supabase security advisors. No SQL writes, migrations, Edge Function deployments, auth-setting changes, or data mutations were performed.

## Verified live database facts

- The production migration ledger contains **283** recorded migrations and ends at version **20261008222845**, named `rc424_atomic_digital_page_payment_webhook`.
- The `public.medical_appointments` table exists.
- Live functions `public.create_medical_appointment_backend(p_user_id uuid, p_appointment_id text, p_business_id uuid, p_doctor_id text, p_date_time bigint, p_reason text)` and `public.update_medical_appointment_status_backend(p_user_id uuid, p_appointment_id text, p_target_status text)` exist.
- The live booking RPC is not the candidate RC468 implementation: its current body rejects a repeated appointment ID with `APPOINTMENT_ID_ALREADY_EXISTS`, has no exact-payload replay response, and sets `search_path` to `public, pg_temp`. Therefore the candidate medical booking behavior must not be exposed in production before the required ordered migration chain is applied and verified.
- The candidate's isolated forward replay from the RC424 schema baseline passed, including its post-replay tenant-isolation step, on candidate HEAD `69df9db11fdaa86ceb9a4d8c62073b121dcd426b`. This proves the disposable replay only; it does not prove production migrations RC425-RC468 are applied.
- The production Edge Function inventory returned 37 active functions. A name inventory is not parity verification against the candidate source.

## Security-advisor findings requiring remediation or explicit review

- Supabase reports **Leaked Password Protection Disabled**. This is a confirmed authentication hardening gap and the production auth-security gate is marked FAIL.
- Supabase reports anonymous-sign-in configuration warnings; verify the intended anonymous-auth policy and disable anonymous sign-ins if they are not a required product feature.
- The advisor reports one anonymous-executable SECURITY DEFINER function, `public.get_mnty_targeted_advertisements(...)`, and 40 authenticated-executable SECURITY DEFINER functions. These are review findings, not proof that every function is exploitable; review each function's actor checks, grants, search path, and intended public contract.
- The advisor reports `public.digital_page_payment_events` has RLS enabled with no policies. Confirm this is an intentional deny-all boundary and document the intended service-role-only access.
- The advisor response contained additional findings. This note records representative findings and does not claim that the full security-advisor queue has been cleared.

## Release decision

**BLOCKED / NOT CERTIFIED.**

Do not apply the candidate migrations or publish the medical UI to production yet. The release still needs a controlled migration plan and verified production ledger reconciliation, authenticated customer/provider cash-flow E2E, live multi-tenant isolation evidence, auth-security remediation, deployed Edge Function parity, and a backup/restore rehearsal. Electronic payment and SMM automation remain deferred per the cash-first launch scope.

## Evidence links

- [Disposable forward migration replay](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39495915562)
- [Doctor Module Release Contract](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39495915671)
- [ERP Runtime Gateway Integration](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39495915548)
- [Module Professionalization Validation](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39495914539)


## Performance-advisor snapshot — 2026-10-21

The read-only Supabase Performance Advisor returned these counts:

- **105 unindexed foreign keys** — prioritize high-write/high-join tables and add only reviewed, non-duplicate indexes through ordered migrations.
- **375 Auth/RLS initialization-plan findings** — review policies for repeated `auth.uid()`/JWT evaluation and apply safe scalar-subquery patterns only after confirming policy semantics.
- **123 unused-index findings** — informational only; do not drop indexes automatically, because advisor windows may not capture rare/critical workloads.
- **28 multiple-permissive-policy findings** — review the effective OR semantics per table/action; consolidate only where the resulting access contract is unchanged.

These are advisor findings, not 631 independently confirmed defects. No automatic index creation, policy rewrite, privilege revocation, or production schema change was performed. Security Advisor still reports leaked-password protection disabled, one anon-executable SECURITY DEFINER function, 40 authenticated-executable SECURITY DEFINER functions, anonymous-sign-in warnings, and one RLS-enabled table with no policies; review each against intended product contracts before changes.
