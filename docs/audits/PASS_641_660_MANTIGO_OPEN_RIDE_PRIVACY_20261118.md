# Pass 641–660 — MantiGO open-ride privacy forward repair (2026-11-18)

## Live finding

The read-only Production function body for `public.list_open_mantigo_rides_backend(uuid)` only compared the supplied user ID to `auth.uid()` and returned up to 100 open ride rows, including customer names and pickup/destination locations. It did not require a captain profile, approval, verification, or availability, nor did it constrain the result by vehicle category. The live function used `search_path=public`.

The checked-in RC446 source and disposable integration already defined the intended active/verified/available captain gate, but the exact RC446 source version `20261010060000` is absent from the live migration ledger. The live ledger currently has 310 rows through `20261110150618`; no Production write was made.

## Forward repair

- Added RC478 (`20261118070000`) as a new forward-only migration; RC446 history is untouched.
- The RPC now rejects anonymous JWT sessions, binds the actor to `auth.uid()`, requires a captain profile in ACTIVE / VERIFIED / AVAILABLE state, and filters open requests to the captain's registered vehicle category.
- Preserved the existing return-column contract, 100-row bound, and authenticated-only EXECUTE boundary. Set `search_path=pg_catalog`.
- Expanded the disposable fixture to model `auth.jwt()` and captain vehicle category.
- Added RC478 integration coverage for ordinary, pending, unverified, offline, anonymous, valid SEDAN/SUV captains, category separation, own-ride exclusion, and closed-ride exclusion.
- Extended the existing RC446/RC477 privacy workflow to apply RC478 last and run its dedicated integration test.

## Release boundary

No Production migration, grant, Auth setting, Edge Function, payment, wallet, settlement or customer data mutation was performed. RC478 is source-only until exact-head CI and the ordered migration replay pass. The encrypted off-site backup and restore rehearsal remain mandatory before Production rollout.
