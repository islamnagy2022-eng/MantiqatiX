# RC70 — High-Risk RLS Authorization Closure

Date: 2026-09-28

## Finding

A live PostgreSQL audit identified broad `ALL` policies for authenticated users on sensitive business, order, payment, settlement, wallet, and financial tables. These policies only excluded anonymous users and therefore could override narrower tenant/role policies because PostgreSQL permissive policies combine with OR semantics.

## Remediation

Removed the broad authenticated-session/non-anonymous `ALL` policies from the high-risk surfaces. The affected tables retain their specific tenant, owner, finance, manager, or self-scope policies.

The final verification query returned zero remaining `ALL` policies on the audited high-risk set.

RLS and FORCE RLS remain enabled on the core audited tables, including orders, payment intents, payment provider events, businesses, financial obligations, general ledger, commission transactions, wallet accounts/transactions, and settlement transactions.

## Safety boundary

No financial rows, users, orders, balances, or transactions were created, changed, or deleted. This was a policy-only security hardening migration.

## Status

High-risk permissive-policy expansion: CLOSED for the audited set.

Two-user/two-tenant runtime E2E remains required for final certification because database policy inspection is not a substitute for an independent-user runtime test.
