# PASS 2051–2060 — Production Edge entrypoint parity recheck
**Date:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Main inspected:** `34a072312b29e613fb95a39050bb499eedabc786`  
**Scope:** read-only comparison of deployed Edge `index.ts` entrypoints with current-main files. No Edge invocation, deployment, DB write, payment, or publication was performed.

## Method and limitation
For each selected function, retrieved the live deployed entrypoint and compared normalized text (line endings and outer whitespace only) with `supabase/functions/<slug>/index.ts` on main. This is an entrypoint-only comparison, not full imported-file/import-map/deployment-bundle certification. Supabase deployed `ezbr_sha256` values are retained as identifiers; they are not directly comparable with Git blob SHAs because they use different hash schemes. No function source body, credentials, or customer data is included here.

## Results

| Function | Live version | Deployed entrypoint SHA-256 | Main entrypoint | Disposition |
|---|---:|---|---|---|
| `catalog-admin` | 20 | `7732207160cf91176d4478d101f85be8789b9eb1ce1b9cd56499994b0cf9ea2c` | DIFFERENT | P0. Deployed admin authorization is behind registry-backed main source. Coordinate RC464/RC471/RC484/RC485 with every dependent policy and caller; do not deploy this function alone. |
| `order-create` | 8 | `16f9b8bb687c33afeca14d85cb4c43af9948bd8b3ef3178990cc76ca1abea782` | DIFFERENT | P1. Main contains the RC498 authenticated order-RPC/JWT path; release matching DB/RPC/ACL and Edge source together. Li2Lak PR #971 remains open. |
| `paymob-webhook` | 10 | `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca` | DIFFERENT | P1. Reconcile provider-event binding, signature/idempotency and atomic webhook migrations before signed Sandbox tests. Paymob stays fail-closed. |
| `payment-intent` | 8 | `d6b8faee1582c73ead440614cbe983114d1e7f31aa50f69795522fb20e737f54` | DIFFERENT | P1. Reconcile amount binding, correlation, idempotency and SQL dependencies before use. |
| `subscription-payment-intent` | 4 | `4466345787ea6b10a29b1dd63e9f0ab3cae640e9bb4d8ecb6d09445809e077e5` | DIFFERENT | P1. Subscription claim/encryption/schema contracts are not certified live; keep checkout deferred. |
| `financial-journal` | 3 | `79ee18d0544e7cab8fe33fe84c27a5017d1163f411eb5b9e07b99fd79e16e366` | DIFFERENT | P1. Journal RPC/ACL contract requires coordinated RC449A/RC450 release and read-back. |
| `settlement-financial-atomic` | 4 | `f9afab1108159f8aba3631e6aeab7395bd0225e6cf7ffc840e5af7c5a008b11d` | DIFFERENT | P1. Registry-backed platform authorization and settlement scope must be released/tested together. No live settlements. |
| `business-register` | 9 | `21a87964716c54043f3d8f2c00b0a75dd4b6d7aec084041b06eb53bca982b54e` | DIFFERENT | P1. Registration path uses an older authorization contract; reconcile platform-root helper and activation behavior first. |
| `directory-listings` | 18 | `bb65d74325f8bdf08f060f7ae2517bb30901630635d1de4f35523d7cef6afe48` | DIFFERENT | Deliberately fail-closed in Production (empty GET, POST 503). Do not deploy the consent-aware main source until RC472/RC473, source rights, owner consent and privacy-negative tests pass. |
| `public-catalog` | 9 | `e12cb7794c4083617924ccf6fb8aae5e572985c2e111e7df7e898dd4be824800` | ENTRYPOINT MATCH | No change proposed. Imported shared dependencies were not fully certified in this pass. |
| `public-catalog-directory` | 19 | `9eec1b65e5f85f0ac640ee44ace2e50abb7106da97bbfe52b8a2fb5ee449b9c6` | ENTRYPOINT MATCH | No change proposed. Imported shared dependencies were not fully certified in this pass. |

The static `health` responder entrypoint also differed from main; it is not included in the nine critical admin/payment/registration/directory mismatches.

## Release decision
- Do not deploy one mismatched Edge function in isolation.
- Pair each Edge bundle with its exact migrations, schema, RPCs, grants and Auth contract.
- Keep Paymob, wallet/payout/settlement and public directory publication fail-closed.
- Keep the two matching public-catalog entrypoints; complete dependency-closure checks before claiming whole-bundle parity.

## Next
- [ ] Compare imported shared files and import maps for all launch-critical functions.
- [ ] Map each of the nine mismatches to exact SQL/RPC/ACL prerequisites and current release-chain status.
- [ ] Run focused PG17/JWT tests per dependency, then prepare a single reviewed coordinated deployment sequence.
- [ ] Verify live versions/hashes and deployed-origin smoke tests after an approved release.

**Disposition:** read-only parity inventory completed; Edge release remains **BLOCKED / NOT CERTIFIED**.


## Addendum — shared dependency bundle comparison — 2026-11-24
A second read-only comparison retrieved every file returned by Supabase for the two public catalog functions and matched it against the shared source files on current main:

| Function | Deployed version | Files compared | Result |
|---|---:|---:|---|
| `public-catalog` | 9 | `source/index.ts`, `_shared/public-price-visibility.mjs`, `_shared/public-contact-visibility.mjs` | **3/3 identical** |
| `public-catalog-directory` | 19 | `source/index.ts`, `_shared/activity-module-overrides.mjs`, `_shared/public-price-visibility.mjs`, `_shared/public-contact-visibility.mjs` | **4/4 identical** |

The comparison normalized only CRLF/LF and outer whitespace. Each deployed file's UTF-8 content matched the corresponding current-main file exactly after normalization. The functions report `import_map=false`; no separate import-map drift was observed. This proves source parity for the files returned by the Supabase function detail API, not runtime behavior or unrelated environment settings.

**Updated disposition:** the two public catalog functions are now source-file parity verified across all returned files in this sample. No redeploy is required for these two functions. The nine critical mismatched functions in the main table remain unchanged and must stay coordinated with DB/RPC/ACL dependencies.
