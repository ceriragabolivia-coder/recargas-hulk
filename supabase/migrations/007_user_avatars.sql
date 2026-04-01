-- Migration: Add user avatars
-- 1. Add avatar_url column to clientes table
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create the Storage bucket for avatars (handles duplicate creation gracefully)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Setup Storage Policies for the avatars bucket
-- Allow public read access
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatar" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'avatars' );

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar" 
ON storage.objects FOR UPDATE
TO authenticated 
USING ( bucket_id = 'avatars' );

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects FOR DELETE
TO authenticated 
USING ( bucket_id = 'avatars' );
