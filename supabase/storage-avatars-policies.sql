-- ============================================================
-- Storage: Avatars bucket RLS policies
-- Run this in Supabase Dashboard → SQL Editor (after creating the "avatars" bucket)
-- ============================================================

-- Remove existing policies so this script can be re-run safely
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are public" ON storage.objects;

-- Allow authenticated users to upload only to a folder named with their user id (path: {user_id}/...)
-- Uses auth.jwt()->>'sub' to match Supabase docs and avoid RLS "new row violates" errors
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

-- Allow users to update/overwrite their own avatar (needed for upsert)
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

-- Allow users to select their own row (needed for upsert flow)
CREATE POLICY "Users can select own avatar"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

-- Public read so profile picture URLs work without logging in
CREATE POLICY "Avatar images are public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');
