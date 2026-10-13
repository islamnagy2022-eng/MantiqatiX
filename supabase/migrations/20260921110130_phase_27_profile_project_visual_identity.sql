-- MantiqaTix Phase 3.27 — Profile & Project Visual Identity
BEGIN;
CREATE TABLE IF NOT EXISTS public.user_profile_media (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_url TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profile_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profile_media_select_self ON public.user_profile_media;
CREATE POLICY user_profile_media_select_self ON public.user_profile_media FOR SELECT TO authenticated
USING (user_id = auth.uid() AND coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');
DROP POLICY IF EXISTS user_profile_media_insert_self ON public.user_profile_media;
CREATE POLICY user_profile_media_insert_self ON public.user_profile_media FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');
DROP POLICY IF EXISTS user_profile_media_update_self ON public.user_profile_media;
CREATE POLICY user_profile_media_update_self ON public.user_profile_media FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
WITH CHECK (user_id = auth.uid() AND coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');
CREATE INDEX IF NOT EXISTS businesses_visual_identity_gin_idx ON public.businesses USING gin (settings);
COMMIT;
