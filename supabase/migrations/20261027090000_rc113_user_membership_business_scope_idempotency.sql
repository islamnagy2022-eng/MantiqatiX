-- Make business-wide memberships idempotent when branch_id is NULL.
-- PostgreSQL UNIQUE indexes treat NULL values as distinct unless explicitly normalized.
-- Preflight against production found no duplicate (user_id, business_id, branch_id) keys.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_memberships_user_business_branch_nullsafe
  ON public.user_memberships (user_id, business_id, (COALESCE(branch_id, '')))
  WHERE business_id IS NOT NULL;
