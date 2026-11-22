-- Allow signed-in users to create their own referral profile and claim one referral.
-- Both SECURITY DEFINER functions enforce auth.uid(), reject anonymous sessions,
-- and prevent self-referral / duplicate claims in their function bodies.
REVOKE EXECUTE ON FUNCTION public.get_or_create_my_referral_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_referral(character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_referral_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral(character varying) TO authenticated;
