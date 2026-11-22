# Pass 1901–1910 — Li2Lak checkout payment fail-closed correction

Date: 2026-11-22  
PR: [#971](https://github.com/islamnagy2022-eng/MantiqatiX/pull/971)

## Finding

- The Li2Lak cart already had `isPaymobAllowed = false`, so Paymob was disabled in the rendered payment choices.
- However, the component retained a client-side mock authorization handler: it simulated a gateway response after a timeout, generated a random `PMB-EG-...` reference and could render a payment-success message if invoked.
- This was not a valid payment integration and must not be capable of producing an order that appears paid.

## Changes

- Added a fail-closed guard at the order-submission boundary: `method === 'paymob'` exits before order persistence and explicitly says no amount was collected.
- Replaced the simulated authorization handler with a disabled-state error; removed the fake delay and generated reference.
- Replaced the false payment-success heading with wording that does not claim payment was received.
- Added source validation requiring the Paymob disabled flag, submission guard and absence of fake references/success text.

## Verification boundary

- Retrieved the updated cart source and static validator from the active PR branch.
- Confirmed the mock reference prefix, simulated handshake and false payment-success text are absent.
- Confirmed the Paymob flag remains false and the explicit fail-closed submission guard is present.
- Exact-head CI has not yet been observed for the latest code head; frontend build and tests remain pending.
- No real payment transaction was attempted. No payment provider, webhook, wallet, Production database, Edge Function or public deployment was changed.

## Release gate

Paymob must remain disabled until server-created payment intents, signed provider callbacks/webhooks, server-side transaction-state reconciliation, refund/chargeback handling and settlement tests pass. Do not interpret a client-generated reference as payment evidence.

**PRODUCTION BLOCKED / NOT CERTIFIED.**
