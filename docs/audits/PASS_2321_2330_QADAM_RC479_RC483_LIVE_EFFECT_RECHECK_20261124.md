# PASS 2321–2330 — Qadam seed and RC479–RC483 provider, digital-page and Legal live effect recheck

**Date:** 2026-11-24
**Method:** aggregate-only seed presence counts and read-only PostgreSQL column grants, function overloads, ACL/search_path and Legal table privilege checks. No personal identifiers, contact values, document contents or customer rows were selected.

| Migration | Current live evidence | Disposition |
|---|---|---|
| Qadam Al-Saad seed | Business=1, active owner membership=1, active branch=1, active products=15, active unexpired prices=12. No stock/orders were fabricated. | **DATA EFFECT PRESENT BY IDEMPOTENCY KEY; exact migration ID remains absent from ledger.** |
| RC479 | anon SELECT remains granted on marketing_provider_profiles; permissive active-provider policy remains; restrictive confirmed-user policy absent. | **BLOCKED — raw base-table read remains exposed.** |
| RC480 | anon has SELECT on every digital_pages column, including internal business/provider/creator fields; the 10-column public renderer allowlist is not installed. | **BLOCKED — overbroad public column visibility.** |
| RC481 | service_role SELECT/INSERT column grants on legal_documents, legal_document_versions, legal_requirements, user_consents and consent_audit_log are absent. | **BLOCKED — Legal Edge grants absent.** |
| RC482 | private.legal_is_admin retains zero-arg and UUID overloads; neither reads private.platform_admins; legal_assert_admin_backend(uuid) absent. | **BLOCKED — Legal registry guard absent.** |
| RC483 | legal_create_document_backend and legal_create_draft_version_backend absent; service_role direct INSERT grants absent as well. | **BLOCKED — atomic Legal CMS create path absent.** |

**Production mutation:** NONE. Qadam seed objects are present but this does not repair missing source-version identity. Legal and public digital-page surfaces remain gated until coordinated release and deployed-origin verification.