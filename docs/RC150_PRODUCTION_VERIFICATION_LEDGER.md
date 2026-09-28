# RC122-RC150 Production Verification Ledger

Date: 2026-09-28

- 113/113 public tables have RLS.
- 100/113 public tables have FORCE RLS.
- 0 public tables lack a primary key.
- 6 public RLS-enabled tables have no policies; no broad policies were added.
- Anonymous Auth users: 0.
- Password users: 6.
- password_encryption: SCRAM-SHA-256.
- Public SECURITY DEFINER functions executable by anon: 0.
- Public SECURITY DEFINER functions executable by authenticated: 1; this is create_payment_intent_backend and remains intentionally callable by the payment-intent backend path.
- Public views: 1; available_payment_methods has no verified anon/authenticated SELECT grant.
- Extensions in public: 0; pg_net is in extensions.
- Payment idempotency and provider-event uniqueness constraints are present.
- Direct anon/authenticated grants on smm_provider_credentials: 0.
- Direct anon/authenticated grants on ERP purchase/receipt/stock-transfer tables: 0.
- RLS is enabled on notifications, support_tickets, orders, marketing_provider_profiles, and marketing_provider_services.
- Current production fixture: 10 ACTIVE memberships, 1 tenant, 6 non-deleted Auth users.
- payment_intents: 0 rows; payment_provider_events: 0 rows.

Conclusion: structural security checks in this ledger are verified. Real payment, webhook replay, multi-tenant isolation, and full customer/provider E2E remain unverified. No synthetic production identities or real-money transactions were created to manufacture verification. Security Advisor, leaked-password protection, release signing, browser/device testing, backup/restore, and rollback remain release-gate items.
