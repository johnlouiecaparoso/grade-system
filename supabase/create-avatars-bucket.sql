-- ============================================================
-- Create the "avatars" storage bucket (required for profile pictures)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Create the bucket (public so profile picture URLs work without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
