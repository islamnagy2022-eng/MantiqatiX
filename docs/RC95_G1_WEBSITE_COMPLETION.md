# RC95 — G1 Website Completion Checkpoint

Date: 2026-09-28

## Scope

G1 covers the existing Website/PWA foundation only. No rebuild from scratch.

## Verified from source

- `web/index.html` exists and boots the public landing experience.
- `web/home.js` provides the public MNTY landing page and public catalog/service/provider sections.
- `web/app.js` provides authenticated application rendering, session handling, module navigation, feature-flag reads, and live data loading.
- `web/config.js` uses the publishable Supabase client configuration only.
- `web/brand.js` provides the MNTY brand layer.
- `web/manifest.webmanifest` and `web/sw.js` provide the PWA baseline.
- GitHub Pages validation already checks required web assets and production-security/auth invariants.

## Implemented in RC95

1. Public entry title and browser/PWA identity aligned to **MNTY — MantiqatiX**.
2. Public landing header/footer identity aligned to **MNTY** while retaining MantiqatiX as the full platform identity.
3. Authenticated/fallback application brand labels aligned to **MNTY**.
4. PWA manifest `name` / `short_name` aligned to **MNTY**.

## Remaining G1 gates

- CI run for the latest RC95 commits must finish successfully.
- External browser smoke test remains required.
- Responsive/accessibility review remains required.
- Route/import/runtime smoke remains required.
- Legacy duplicate render path cleanup remains pending; it must not remove the fallback landing path until the primary `MXHomeLanding` path is externally verified.
- G1 is **not VERIFIED** until the above evidence exists.

## Rule

DONE != VERIFIED. G2 must not be closed before G1 has a verified baseline.
