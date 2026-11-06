# AI Studio V6 — canonical r5 source

The immutable public MVP r5 source archive is stored as `source-r5-preview.tar.xz`. The preparation script verifies its SHA-256 and extracts the app into an ignored `worktree/`.

- Original candidate ZIP SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`
- Public MVP source pack SHA-256: `6f674e95cdaddd28cb21795a05d8ad5b34c4b7b5d606d335af0556fb1fa2e7e5`
- Preview base: `/MantiqatiX/v6-preview/`
- Public release scope: directory, activity and specialty filters, medical directory, verified business profiles, read-only product/service catalog, published prices, phone/WhatsApp contact.
- Hidden from the public shell: admin/merchant dashboards, wallets, orders, checkout, internal messaging, simulated AI registration, local writes, promotional carousels and sponsored-ad columns.
- Unverified activities expose only name, location and contact. Their catalog and extended profile remain hidden until verified.

This import does not deploy Pages or mutate production.


V6 loads the shared public runtime configuration from `/MantiqatiX/config.js`. The config adapter accepts only a Supabase publishable key or an anon-role JWT; service-role credentials are rejected. Standalone builds can still use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
