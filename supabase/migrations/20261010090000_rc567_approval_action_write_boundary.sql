-- RC567: prevent ordinary authenticated clients from forging approval audit actions.
-- The authoritative approval transition/backend writer must be implemented and reviewed separately.
-- Source-only until tests, review, and approved release.
REVOKE INSERT ON TABLE public.approval_actions FROM authenticated;
DROP POLICY IF EXISTS approval_actions_member_insert ON public.approval_actions;
