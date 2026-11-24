-- RC924: correct participant-to-parent agreement correlation.
-- Preserve the existing non-anonymous authenticated and platform-admin boundary.
-- This is an additive forward repair; no table, row, grant or helper is changed.
BEGIN;

DROP POLICY IF EXISTS agreements_participant_read ON public.agreements;

CREATE POLICY agreements_participant_read
  ON public.agreements
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (((SELECT auth.jwt()) ->> 'is_anonymous')::boolean IS FALSE)
    AND (
      private.legal_is_admin((SELECT auth.uid()))
      OR EXISTS (
        SELECT 1
        FROM public.agreement_participants ap
        WHERE ap.agreement_id = agreements.id
          AND ap.user_id = (SELECT auth.uid())
      )
    )
  );

COMMIT;
