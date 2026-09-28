# RC164 — MantiGO Direct Delete Lockdown

Production hardening applied:
- removed direct DELETE policies from `mantigo_rides` and `mantigo_bids`;
- revoked DELETE from `anon` and `authenticated`;
- lifecycle data can no longer be removed by the client through direct table operations.

Production verification: no UPDATE or DELETE policies remain on either MantiGO table.

Open release gates remain: full customer/driver E2E, matching concurrency, notification delivery, payment/settlement, cancellation/refund policy, offline/device verification, and final release rehearsal.
