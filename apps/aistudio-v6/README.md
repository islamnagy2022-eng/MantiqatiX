# AI Studio V6 — canonical r5 source

The immutable r5 source archive is stored as five base64 text parts under `source-pack-parts/`. The preparation script reconstructs the tar.xz, verifies its SHA-256, and extracts the app into an ignored `worktree/`.

- Original candidate ZIP SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`
- Public MVP source pack SHA-256: `166db4a0ce4bd52d1e871d44eb8400aa9292b08fb0a2d076b77495284f8497a0`
- Preview base: `/MantiqatiX/v6-preview/`
- Public release scope: directory, activity and specialty filters, medical directory, verified business profiles, read-only product/service catalog, published prices, phone/WhatsApp contact.
- Hidden from the public shell: admin/merchant dashboards, wallets, orders, checkout, internal messaging, simulated AI registration, local writes, promotional carousels and sponsored-ad columns.
- Unverified activities expose only name, location and contact. Their catalog and extended profile remain hidden until verified.

This import does not deploy Pages or mutate production.
