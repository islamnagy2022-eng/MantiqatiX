# PASS 2371–2380 — Live Edge runtime source parity recheck

**Repository checkpoint:** `main @ 00a8d369ccc8d5b1fb6ef29db87178c65ebddd27`
**Production project:** `MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu`
**Method:** read-only `list_edge_functions` + `get_edge_function`; exact deployed entrypoint text comparison with current-main entrypoint. The two `public-catalog` shared helper files were also compared byte-for-byte.

## Nine launch-critical entrypoints differ from current main

| Function | Deployed version | verify_jwt | Deployed bundle fingerprint | Main Git blob SHA | Deployed / main chars | Match |
|---|---:|---:|---|---|---:|---|
| `payment-intent` | 8 | true | `d6b8faee1582c73ead440614cbe983114d1e7f31aa50b9e07b99fd79e16e366` | `5fd63573a8229bb65ef999293ed17520a0eaf8b9` | 8,114 / 10,146 | NO |
| `paymob-webhook` | 10 | false | `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca` | `2eee7c80756e3c9a6b4310b65c90b7d8d2464c67` | 11,538 / 12,376 | NO |
| `digital-page-payment-intent` | 5 | true | `8aa3d2e9c025e7b74d4d1847e8a6744bc84a9ded7cfc0c721f9604efd177af4b` | `0d0476b0120996d83fff1299e06ea2c037e62e8e` | 5,345 / 6,532 | NO |
| `subscription-payment-intent` | 4 | true | `4466345787ea6b10a29b1dd63e9f0ab3cae640e9bb4d8ecb6d09445809e077e5` | `c702d7a70ea85727ec5e14695ebf8fb26158514e` | 5,196 / 11,100 | NO |
| `settlement-financial-atomic` | 4 | true | `f9afab1108159f8aba3631e6aeab7395bd0225e6cf7ffc840e5af7c5a008b11d` | `f1d3b439c59dff88668b54667bf371ec7411087b` | 2,314 / 7,442 | NO |
| `financial-journal` | 3 | true | `79ee18d0544e7cab8fe33fe84c27a5017d1163f411eb5b9e07b99fd79e16e366` | `49706589cc6d77af713ae44bcc0818066de72243` | 1,591 / 3,387 | NO |
| `order-create` | 8 | true | `16f9b8bb687c33afeca14d85cb4c43af9948bd8b3ef3178990cc76ca1abea782` | `3a6777683e537dcff1ad30cbd1c89e431f77d926` | 10,083 / 13,988 | NO |
| `catalog-admin` | 20 | false | `7732207160cf91176d4478d101f85be8789b9eb1ce1b9cd56499994b0cf9ea2c` | `88d2f2ef4e1c3a7ca160125e595110b4e6c7b80b` | 37,862 / 44,115 | NO |
| `erp-purchase-receive` | 3 | true | `b9c47d6a2d5a23404a41725e40bf3f2876384c4ced0aba814c24a5e395029804` | `1caf263eaa5bae6f9b9f8360b2f2390ef3c569bf` | 5,221 / 6,075 | NO |

## Additional live runtime drift

| Function | Version | verify_jwt | Deployed bundle fingerprint | Main Git blob SHA | Deployed / main chars |
|---|---:|---:|---|---|---:|
| `catalog-platform-admin` | 23 | true | `4f0d4432c134b51848038a5c3344b1e15c95875619b8b1c17f21ab6f097508c5` | `f6a825316f56bb20bec6a79d278d823a16700930` | 63,454 / 67,227 |
| `mnty-push-dispatch` | 4 | false | `3a3cb93a869e11bce2ab12eca2171434e6809cc63babcdf4ff8a5864d2c4aaa9` | `3ba8e6ce43a6b549838e0b3cbe6b04ba348658d8` | 3,755 / 4,197 |
| `health` | 3 | false | `1b664d59f8c9413d9e5fbcb85cbef01fc05edd41e1c20815dc6ee84737432564` | `1f0f532d1a777a15d6dcaed9629ce1320a33bc7b` | 298 / 3,238 |
| `directory-listings` | 18 | false | `bb65d74325f8bdf08f060f7ae2517bb30901630635d1de4f35523d7cef6afe48` | `78bd91897cc9071e1b23cd2a56714e582c0661d5` | 2,054 / 54,284 |

The deployed `directory-listings` v18 is intentionally fail-closed: GET returns an empty set with `directoryDisabled=true`; POST returns 503 until RC472/RC473 source-rights and consent gates are live. This is a protective state, not a reason to replace it with the current-main handler.

## Confirmed public-catalog parity

| Function | Version | verify_jwt | Deployed bundle fingerprint | Main Git blob SHA | Deployed chars | Match |
|---|---:|---:|---|---|---:|---|
| `public-catalog` | 9 | false | `e12cb7794c4083617924ccf6fb8aae5e572985c2e111e7df7e898dd4be824800` | `207c1669b3897a5d1c718a527781609c798b575b` | 13,970 | YES |
| `public-catalog-directory` | 19 | false | `9eec1b65e5f85f0ac640ee44ace2e50abb7106da97bbfe52b8a2fb5ee449b9c6` | `8176081d24b7c1e93017ddcdf982d73d755f4ea8` | 19,804 | YES |

The two deployed `public-catalog` shared helpers also match current main exactly: `public-price-visibility.mjs` (1,087 characters; Git blob `4fed450c73aeb9d799c613442f139e004d29a9d6`) and `public-contact-visibility.mjs` (3,529 characters; Git blob `9340de9e5e35f49103a8ee6262b4e12c52c278b7`).

## Authentication and comparison limitations

- `verify_jwt=false` alone does not prove a bypass. Deployed `catalog-admin` manually parses a Bearer token, calls `auth.getUser(token)`, and rejects missing/anonymous users; its platform-root decision still calls the legacy `mnty_can_platform_admin()` helper described in PASS 2361–2370.
- Deployed `paymob-webhook` contains Paymob HMAC-SHA512 verification and constant-time string comparison before processing a provider event. This does not erase source drift or replace payment end-to-end reconciliation.
- Deployed `mnty-push-dispatch` reads a stored webhook secret and compares `x-mnty-push-secret`; current main imports `_shared/push-dispatch-security.mjs`, which was not present in the deployed file read-back. Compare rate limiting, bounded payload parsing and timeout behavior before release.
- The Supabase `ezbr_sha256` is a deployed runtime bundle fingerprint, not the same hash type as GitHub's file blob SHA. Exact-match results above come from text comparison of returned deployed file contents with the named current-main file. Checks cover single-file entrypoints and the two public-catalog helpers only; full compiled bundle, import-map and transitive dependency parity remains **NOT VERIFIED**.

## Release disposition

**No Edge function was deployed or changed.** No database, Auth, RLS, GRANT, Storage, payments, settlement or business data was changed.

Nine launch-critical entrypoints differ from current main; additional differences exist in `catalog-platform-admin`, `mnty-push-dispatch`, `health` and the intentionally disabled `directory-listings` stub. Do not deploy functions individually. Release remains blocked until each runtime is mapped to exact migration/schema/RPC/ACL dependencies, complete bundle, JWT/signature policy, secret-name contract, rollback artifact and deployed-origin negative/positive tests.
