-- Add avatar_url to profiles for profile picture
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Storage: Create bucket "avatars" in Dashboard → Storage → New bucket (public).
-- Then run the policy below in SQL Editor (Storage policies are under storage.objects).
-- Policy: Allow authenticated users to upload to their own path and read public URLs.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
-- CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated
--   USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Avatar images are public" ON storage.objects FOR SELECT TO public
--   USING (bucket_id = 'avatars');
