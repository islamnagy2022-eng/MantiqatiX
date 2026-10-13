BEGIN;
GRANT SELECT,INSERT,UPDATE ON public.legal_documents,public.legal_document_versions TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.agreements,public.agreement_participants TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.legal_requirements TO authenticated;
COMMIT;
