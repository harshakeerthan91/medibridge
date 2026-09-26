-- 003_grant_permissions.sql
-- Grants permissions to the authenticated role for all application tables.
-- Row Level Security (RLS) is already enabled on all these tables to enforce ownership.

BEGIN;

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Array of all tables defined in 001_initial_schema.sql
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'documents',
    'document_pages',
    'processing_jobs',
    'lab_results',
    'prescriptions',
    'prescription_items',
    'explanations',
    'medication_schedules',
    'medication_logs',
    'followups',
    'symptom_entries',
    'saved_questions',
    'chat_threads',
    'chat_messages',
    'chat_message_sources',
    'visit_briefs',
    'brief_sources',
    'chat_rate_limits'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', t);
  END LOOP;
END;
$$;

COMMIT;
