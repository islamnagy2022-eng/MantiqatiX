# RC164 — MantiGO Legacy Mutator Retirement

The legacy `public.mantigo_mutate(text,jsonb)` function previously retained EXECUTE for authenticated users and contained an older MantiGO mutation model (`SEARCHING_BIDS`).

The current production path uses dedicated backend contracts from RC161/RC162. Direct EXECUTE on the legacy mutator has therefore been revoked from public, anon and authenticated roles.

Production verification: revoke applied successfully.

Open: caller inventory/E2E confirmation before any future removal of the legacy function itself.
