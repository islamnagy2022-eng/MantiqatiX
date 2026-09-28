# RC163 — MantiGO Direct Update Lockdown

Production hardening applied:
- removed direct UPDATE policies from `mantigo_rides` and `mantigo_bids`;
- revoked `UPDATE` table privilege from `anon` and `authenticated`;
- lifecycle changes must use backend-authoritative workflow functions.

Verified production state after migration: the previous owner/captain UPDATE policies are absent and direct client UPDATE privilege is revoked.

Open: browser E2E, matching concurrency, notification delivery, payment/settlement and device/offline verification.
