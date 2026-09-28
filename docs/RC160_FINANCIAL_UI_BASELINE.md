# RC160 — Financial Journal UI Baseline

Activated the existing Finance workspace with a guarded journal-posting action.

The UI:
- shows the action only to financial-capable roles;
- obtains the current Supabase session token;
- calls the authenticated `post-financial-journal` Edge Function;
- does not write directly to journal or ledger tables;
- sends a balanced two-line manual journal payload.

Source commit: c2dc8d5fb27ae295b8cd70cc7bbd38bbe84aa860

Not verified:
- browser E2E with a real financial member
- invalid account / unbalanced / cross-tenant negative tests through the browser
- real production journal posting
- CI workflow for the commit
