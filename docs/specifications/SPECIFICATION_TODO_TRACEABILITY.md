# MantiqaTix — Operating Specification 00–19 TODO Traceability

**Baseline:** current `main` at the start of this work; branch-only documentation update.  
**Purpose:** connect each owner specification to the existing canonical TODO registers without duplicating, deleting, or silently closing work.

## Source-of-truth hierarchy

1. `docs/specifications/OPERATING_SPECIFICATIONS_00_19.md` — owner requirements; requirements are not evidence of implementation.
2. `docs/MASTER_PRODUCTION_TODO.md` — global platform, module, and release register.
3. `TODO_PRODUCTION.md` — detailed website/catalog and production execution register.
4. `docs/TODO_MASTER_DEVELOPMENT.md` — module scope and acceptance blueprint.
5. `docs/PROJECT_CONTINUITY.md` and `docs/SESSION_LOG.md` — chronological decisions, evidence, and next actions.

The IDs `SPEC-00` through `SPEC-19` are stable cross-reference keys only. They do not replace existing TODO entries or imply completion. Existing checkboxes and evidence remain authoritative.

## Cross-reference map

| Trace ID | Owner specification | Canonical TODO references | What must be reconciled / acceptance focus |
|---|---|---|---|
| SPEC-00 | Master command / overall system | Master: P0 release gate, Execution rule, RC530–RC540, Production Release Gate. Root: P0 release snapshot, Support & Governance, Release. Module blueprint: #0, #29, #32. | Maintain one verified baseline; perform impact analysis before edits; track dependencies, evidence, rollback, and release state. No Production Ready claim while any mandatory gate is open. |
| SPEC-01 | Management and operations | Root: P1 Operations, Automation/Notifications, Monitoring/Maintenance. Master: RC480 Operations Command Workspace, RC500 Attention Center. Module: #15. | Every task needs an owner/priority/dependency/status/acceptance criterion; close only after integration and verification. |
| SPEC-02 | Technology and programming | Root: P1 Website/Platform, QA, Release, P0. Master: CORE platform, module runtime/release sections, RC530–RC550. Module: #1, #23, #25, #29. | Reuse current architecture and contracts; minimal additive change; lint/typecheck/build, integration, security, runtime, and regression evidence. |
| SPEC-03 | Accounts and finance | Root: P1 Finance and P0 payment/finance blockers. Master: RC490 Finance Control Workspace, payment/settlement/journal gates. Module: #11, #12. | Preserve server-authoritative pricing and postings, idempotency, audit, tenant isolation, reconciliation, and real-provider acceptance. Never fabricate financial events. |
| SPEC-04 | Marketing | Root: P1 Marketing & Advertising and P2 SMM (deferred). Master: RC470 Marketing Workspace and campaign/CRM scope. Module: #13. | Verify campaign lifecycle, consent/ownership, provider credentials, spend limits, attribution, and ROI from real events. SMM stays deferred until its separate security/runtime gate passes. |
| SPEC-05 | Design and visual identity | Root: P2 Design/Brand; Website UI no-regression guard. Master: homepage/catalog UX and dashboard visual/accessibility checks. Module: #23. | Preserve current deployed catalog layout, RTL, brand, cards, covers, and responsive behavior unless a specific visual change is requested. Review only minimal diffs and regression evidence. |
| SPEC-06 | Customer relationship management | Root: P1 CRM. Master: RC460 Unified CRM Workspace and CRM tenant-scope gates. Module: #14. | Trace leads and interactions through qualification, follow-up, conversion, retention, audit, and tenant/business-scoped authorization. |
| SPEC-07 | Providers and sectors | Root: P1 Providers/Sectors, Website/Catalog, directory discovery and taxonomy tasks. Master: provider onboarding, sector/category, service and directory sections. Module: #3, #4, #5, #9, #22. | Reuse canonical group/category/specialty IDs; preserve activity vs profession classification, verified-first ordering, geographic filters, owner claim, and provider scope. Do not invent listings or contact data. |
| SPEC-08 | Users, roles, and permissions | Root: P1 Users/Roles/Permissions and P0 Auth/RLS. Master: role-specific workspaces, RC400/RC410, employee and tenant-isolation gates. Module: #2, #19, #20. | Enforce least privilege, server-side authorization, tenant/business/branch isolation, safe membership lifecycle, and audit of sensitive actions. |
| SPEC-09 | Database and security | Root: P0 migration, RLS, SECURITY DEFINER, Edge Function and Auth blockers. Master: P0 security/reconciliation and RC360/RC530/RC540. Module: #20, #29. | Reconcile exact migration effects and live ACL/RLS/function contracts. Never replay historical SQL blindly, bulk-revoke grants, add broad policies, or bypass fail-closed guards. |
| SPEC-10 | Website, app, and unified platform | Root: P1 Website/Platform and P2 Mobile App. Master: unified runtime and release sections. Module: #23 and #24. | Keep shared data/business logic on approved shared APIs while preserving platform-specific UI. The catalog website remains primary; Android remains deferred and is not changed by this website continuation. |
| SPEC-11 | Analytics and reporting | Root: P1 Analytics/Reports. Master: RC510 Real-Data Analytics Workspace and reporting contracts. Module: #18. | Distinguish FACT, CALCULATION, ANALYSIS, EXCEPTION, RISK, and NOT VERIFIED; source every metric from persisted, authorized data. |
| SPEC-12 | Operations and task management | Root: P1 Operations. Master: RC480 Operations Command Workspace and RC500 Attention Center. Module: #15. | Use explicit task states, dependencies, owners, due dates, outputs, and acceptance criteria; DONE is not VERIFIED. |
| SPEC-13 | Automation and notifications | Root: P1 Automation/Notifications. Master: notification lifecycle and attention-center sections. Module: #16. | Use event → validation → action → log → notification; enforce idempotency, authorization, observability, and disable/rollback controls. |
| SPEC-14 | Content and platform management | Root: P1 Content/Platform Management. Master: CMS, digital pages, publishing, and catalog sections. Module: #8, #17. | Enforce Draft → Review → Approved → Published → Hidden/Archived; preserve content provenance and partial updates; no false verification or fabricated business details. |
| SPEC-15 | Monitoring and maintenance | Root: P1 Monitoring/Maintenance and P0 monitor evidence. Master: RC520 System Health & Security Center and production observability. Module: #27. | Verify error/alert delivery, service health, incident handling, recovery, and measured operational objectives; document monitor coverage limits. |
| SPEC-16 | Backup and recovery | Root: P1 Backup/Recovery and P0 restore gate. Master: RC262 and Production Release Gate. Module: #26, #29. | A backup is not accepted until a restore and rollback rehearsal succeeds against an isolated, schema-faithful environment with recorded RPO/RTO. |
| SPEC-17 | Testing and quality assurance | Root: P1 QA and P0 regression/browser/device gates. Master: RC255, RC359, module testing and release contracts. Module: #25. | Run the right tests at each layer; exact-head CI, browser E2E, tenant/security regressions, device review, and production smoke must be separately evidenced. |
| SPEC-18 | Release and versions | Root: P1 Release and P0 production gate. Master: Production Release Gate, RC530–RC550. Module: #29. | Maintain Development → Testing → Staging → Production separation, approval, exact artifacts, rollback, and post-release monitoring. No deployment authorization is inferred from source merge or CI alone. |
| SPEC-19 | Governance and control | Root: P1 Support/Governance and all dated TODO evidence. Master: Execution rule, RC373, RC248, governance/compliance sections. Module: #28, #32. | Preserve append-only history, authoritative source references, change approvals, stable baselines, explicit uncertainty, and a resumable session handoff. |

## Current cross-register status

- **Mapped:** all 20 owner specifications now have a stable `SPEC-00`–`SPEC-19` reference and links to the existing registers.
- **Not implied:** mapping does not mark any module, implementation, production object, test, or release gate as complete.
- **Existing open work retained:** the two TODO registers and the module acceptance blueprint remain in force; do not bulk-close historical entries.
- **UI guard:** current deployed catalog UI is frozen for this continuation. The taxonomy folder navigation is already present through merged PR #500; deployed-origin folder interaction, mobile/tablet and accessibility verification remains open. A test or code change must not redesign the homepage, cards, covers, verified-first ordering, geographic search, or storefront flows.
- **Production guard:** current release status remains `BLOCKED / NOT CERTIFIED`. Isolated CI evidence is not live migration, Edge Function, payment, or backup/restore approval.
- **Platform scope:** this continuation concerns the website/catalog and shared backend contracts only; it does not authorize Android changes.

## Next execution sequence

1. Reconcile the module acceptance blueprint against the two canonical TODO registers, using this map to avoid duplicate tasks.
2. Verify the already-merged taxonomy folder navigation against the deployed catalog origin with automated browser coverage where the existing test harness supports it; record real-device/accessibility review separately.
3. Continue with the highest executable P0 blocker only after its source, live contract, authorization boundary, and regression surface are identified.
4. Append exact commit/PR/workflow/runtime evidence to the session log and continuity handoff. Keep unverified behavior open.

## UI no-regression checklist

- [ ] No visual redesign, layout replacement, or removal of existing catalog/admin features.
- [ ] Homepage, cards, cover carousel, mobile grid, RTL and responsive breakpoints unchanged unless a specific defect is demonstrated.
- [ ] Verified activities remain ahead of unverified activities; both remain in the same result set.
- [ ] Geographic search and group/category/specialty navigation retain their current contracts.
- [ ] Storefront, permanent links, QR payloads, owner/admin workflows, and existing routes are not regressed.
- [ ] Any changed UI has a minimal diff, exact-head build, browser regression, and explicit before/after evidence.

## Evidence labels

Use `IMPLEMENTED` for source presence, `PASS` for a successful named test, `DEPLOYED` only for a verified deployment, `NOT VERIFIED` for missing runtime/device evidence, and `BLOCKED` for unmet prerequisites. Never infer one state from another.
