# RC73 — Observability & Performance Gate

Date: 2026-09-28

Supabase logs are active across edge, Postgres, PostgREST, Auth, Storage and related services. A recent log inventory returned activity across the production services.

The available performance advisor reports a large set of informational foreign-key/index findings and a smaller set of multiple-permissive-policy findings. These are not being converted into speculative index changes during release hardening; broad index creation/removal without workload evidence is deferred.

Security Advisor continues to report the known leaked-password-protection configuration warning and RLS/no-policy review items on selected isolated tables. These remain tracked release gates rather than evidence of a blanket data leak.

Status: observability available; complete alert/drill certification remains OPEN.