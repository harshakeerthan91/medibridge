-- Storage bucket creation and policies
-- Run this AFTER creating your Supabase project and running migrations

-- Create private medical-records bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-records',
  'medical-records',
  FALSE,
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- RLS Policies for storage
-- Users can only upload to their own folder: {user_id}/{document_id}/{filename}

CREATE POLICY "storage_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'medical-records'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "storage_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'medical-records'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "storage_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'medical-records'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'medical-records'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );
