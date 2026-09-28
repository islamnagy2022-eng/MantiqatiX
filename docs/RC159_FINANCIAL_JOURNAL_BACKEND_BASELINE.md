# RC159 — Financial Journal Backend Baseline

Implemented a backend-only financial journal posting contract and deployed an authenticated Edge Function.

Database contract:
- `public.post_financial_journal_backend(uuid,jsonb,jsonb)`
- SECURITY DEFINER with `search_path=public`
- requires authenticated user identity to match `p_user_id`
- requires ACTIVE tenant membership with a financial-capable role
- requires equal positive total debit/credit
- validates every account belongs to the tenant and is active
- rejects negative lines and lines containing both debit and credit
- posts journal entry, journal lines and general ledger rows atomically in one function transaction
- client roles are not granted EXECUTE directly

Edge Function:
- `post-financial-journal`
- ACTIVE version 1
- `verify_jwt=true`
- deployed SHA-256: `9496c2311aa48e916ea884b3dc458f21c90763baf4551e0dd16db52214cae987`

Source commits:
- migration: `bb777f13969f87a8228a6ee025292b47da4ea037`
- Edge Function source: `cdc7498b81c9f6c4eab91f4d75fe1267b40c2ae5`

Open:
- UI integration is not enabled because repository security validation blocked the attempted app.js financial UI patch.
- Browser E2E and real journal rehearsal remain NOT VERIFIED.
- No production financial transaction was created during this change.
