# R7 Android wrapper — preserved source only

These files are copied from the uploaded `bizcatalog-manager (11).zip` R7 archive (build timestamp 2026-11-10). They are preserved for continuity and are **not** the active Android project.

## Do not build or release this source as-is

- The WebView and API URLs hardcode the legacy `mantiqatix.com` origin/API and do not match the current GitHub Pages deployment.
- JavaScript is enabled and a native JavaScript bridge is exposed without a verified message/origin trust boundary.
- Navigation does not enforce a strict first-party host allowlist.
- The archive does not contain Gradle settings/root build files, Gradle wrapper, the referenced `proguard-rules.pro`, or the referenced mipmap launcher resources.
- Auth/session, OAuth callback, API, deep-link and storage contracts have not been reconciled with current main.

Before any native Android integration, rebuild this wrapper against current app/backend contracts, add an explicit safe navigation allowlist and bridge validation, restore complete Gradle/resources/test structure, configure signing through protected secrets, and run emulator/device regression.

The original R7 mobile web components remain in the uploaded archive at `src/components/mobile/`; they are not copied into current app source because they depend on the older R7 context and utility modules.
