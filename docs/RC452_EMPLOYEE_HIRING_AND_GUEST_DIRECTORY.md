# RC114 — Employee & Hiring System Per Activity

- Each business can define its own job positions, department, employment type, branch, hiring status and permission template.
- Employee records track invitation, active, suspended and ended states, existing Auth identity linkage, scoped permissions, and audit history.
- Only authorized business owners/admins (or the authoritative platform admin) can manage positions and employees.
- Existing identities are reused; this migration does not create Auth users or send invitations automatically.
- Position templates are metadata until each module's server-side operations enforce their permissions. They do not bypass RLS.
- Guest discovery is independent of subscription and catalog publication; only active businesses in non-test tenants are listed. Items/prices are included only when catalog publication is explicitly enabled.
- WhatsApp contact is surfaced from the public branch phone or explicitly configured catalog profile phone; payments remain disabled.
- CI structural contract added. Isolated behavioral tests, UI wiring, edge deployment and real browser checks remain release gates.
