-- Corrected initial migration; run against a fresh application schema.
-- No existing tables or data are dropped. Not a rerunnable migration.

BEGIN;

-- MediBridge Initial Schema Migration

-- All tables have RLS enabled. Patients can only access their own data.

-- Enable required extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================

-- PROFILES

-- ============================================================

CREATE TABLE profiles (

  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  full_name TEXT,

  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'te', 'hi')),

  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles

  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles

  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles

  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON profiles

  FOR DELETE USING (auth.uid() = id);

-- Auto-create profile on signup

CREATE OR REPLACE FUNCTION handle_new_user()

RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$

BEGIN

  INSERT INTO profiles (id) VALUES (NEW.id)

  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

END;

$$;

CREATE TRIGGER on_auth_user_created

  AFTER INSERT ON auth.users

  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================

-- DOCUMENTS

-- ============================================================

CREATE TYPE document_status AS ENUM (

  'uploaded', 'processing', 'needs_review', 'ready', 'failed', 'deleting'

);

CREATE TYPE document_category AS ENUM (

  'lab_report', 'prescription', 'discharge_summary', 'other', 'unclassified'

);

CREATE TABLE documents (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  filename TEXT NOT NULL,

  mime_type TEXT NOT NULL,

  size_bytes BIGINT NOT NULL,

  page_count INT,

  storage_path TEXT NOT NULL,

  sha256_hash TEXT NOT NULL,

  status document_status NOT NULL DEFAULT 'uploaded',

  category document_category NOT NULL DEFAULT 'unclassified',

  report_date DATE,

  extracted_patient_name TEXT,

  patient_name_mismatch BOOLEAN NOT NULL DEFAULT FALSE,

  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'in_review', 'reviewed')),

  revision INT NOT NULL DEFAULT 0,

  idempotency_key TEXT,

  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  deleted_at TIMESTAMPTZ,

  UNIQUE(owner_id, sha256_hash)

);

CREATE INDEX idx_documents_owner ON documents(owner_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_documents_status ON documents(owner_id, status) WHERE deleted_at IS NULL;

CREATE INDEX idx_documents_category ON documents(owner_id, category) WHERE deleted_at IS NULL;

CREATE INDEX idx_documents_hash ON documents(owner_id, sha256_hash);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own" ON documents

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "documents_insert_own" ON documents

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "documents_update_own" ON documents

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "documents_delete_own" ON documents

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- DOCUMENT PAGES

-- ============================================================

CREATE TABLE document_pages (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  page_number INT NOT NULL,

  page_text TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(document_id, page_number)

);

CREATE INDEX idx_doc_pages_document ON document_pages(document_id);

CREATE INDEX idx_doc_pages_owner ON document_pages(owner_id);

CREATE INDEX idx_doc_pages_text ON document_pages USING gin(to_tsvector('english', COALESCE(page_text, '')));

ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_pages_select_own" ON document_pages

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "doc_pages_insert_own" ON document_pages

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "doc_pages_update_own" ON document_pages

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "doc_pages_delete_own" ON document_pages

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- PROCESSING JOBS

-- ============================================================

CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE processing_jobs (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  status job_status NOT NULL DEFAULT 'pending',

  attempt_count INT NOT NULL DEFAULT 0,

  max_attempts INT NOT NULL DEFAULT 3,

  error_category TEXT,

  error_message TEXT,

  heartbeat_at TIMESTAMPTZ,

  lock_expires_at TIMESTAMPTZ,

  revision INT NOT NULL DEFAULT 0,

  idempotency_key TEXT NOT NULL,

  started_at TIMESTAMPTZ,

  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(idempotency_key)

);

CREATE INDEX idx_jobs_document ON processing_jobs(document_id);

CREATE INDEX idx_jobs_owner ON processing_jobs(owner_id);

CREATE INDEX idx_jobs_status ON processing_jobs(status);

ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select_own" ON processing_jobs

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "jobs_insert_own" ON processing_jobs

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "jobs_update_own" ON processing_jobs

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ============================================================

-- LAB RESULTS

-- ============================================================

CREATE TYPE review_status AS ENUM ('unreviewed', 'reviewed', 'uncertain', 'corrected');

CREATE TABLE lab_results (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  original_label TEXT NOT NULL,

  normalised_name TEXT,

  result_text TEXT,

  result_numeric NUMERIC,

  unit TEXT,

  original_range TEXT,

  range_low NUMERIC,

  range_high NUMERIC,

  report_date DATE,

  page_number INT,

  source_passage TEXT,

  uncertainty_reason TEXT,

  review_status review_status NOT NULL DEFAULT 'unreviewed',

  reviewed_at TIMESTAMPTZ,

  revision INT NOT NULL DEFAULT 0,

  extraction_revision INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_lab_results_owner ON lab_results(owner_id);

CREATE INDEX idx_lab_results_document ON lab_results(document_id);

CREATE INDEX idx_lab_results_name ON lab_results(owner_id, normalised_name);

CREATE INDEX idx_lab_results_date ON lab_results(owner_id, report_date);

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_results_select_own" ON lab_results

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "lab_results_insert_own" ON lab_results

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "lab_results_update_own" ON lab_results

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "lab_results_delete_own" ON lab_results

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- PRESCRIPTIONS

-- ============================================================

CREATE TABLE prescriptions (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  prescriber_name TEXT,

  prescriber_date DATE,

  review_status review_status NOT NULL DEFAULT 'unreviewed',

  reviewed_at TIMESTAMPTZ,

  revision INT NOT NULL DEFAULT 0,

  extraction_revision INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescriptions_select_own" ON prescriptions

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "prescriptions_insert_own" ON prescriptions

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "prescriptions_update_own" ON prescriptions

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "prescriptions_delete_own" ON prescriptions

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- PRESCRIPTION ITEMS

-- ============================================================

CREATE TABLE prescription_items (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,

  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  original_medicine_name TEXT NOT NULL,

  strength TEXT,

  dose TEXT,

  route TEXT,

  frequency TEXT,

  duration TEXT,

  meal_instructions TEXT,

  page_number INT,

  source_passage TEXT,

  missing_fields TEXT[],

  uncertain_fields TEXT[],

  review_status review_status NOT NULL DEFAULT 'unreviewed',

  reviewed_at TIMESTAMPTZ,

  revision INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_presc_items_owner ON prescription_items(owner_id);

CREATE INDEX idx_presc_items_prescription ON prescription_items(prescription_id);

ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presc_items_select_own" ON prescription_items

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "presc_items_insert_own" ON prescription_items

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "presc_items_update_own" ON prescription_items

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "presc_items_delete_own" ON prescription_items

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- EXPLANATIONS

-- ============================================================

CREATE TABLE explanations (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  language TEXT NOT NULL CHECK (language IN ('en', 'te', 'hi')),

  what_it_says TEXT,

  what_terms_mean TEXT,

  questions_for_appointment TEXT,

  document_revision INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(document_id, language, document_revision)

);

CREATE INDEX idx_explanations_owner ON explanations(owner_id);

CREATE INDEX idx_explanations_document ON explanations(document_id, language);

ALTER TABLE explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "explanations_select_own" ON explanations

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "explanations_insert_own" ON explanations

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "explanations_update_own" ON explanations

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "explanations_delete_own" ON explanations

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- MEDICATION SCHEDULES

-- ============================================================

CREATE TABLE medication_schedules (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  prescription_item_id UUID NOT NULL REFERENCES prescription_items(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  medicine_name TEXT NOT NULL,

  dose TEXT NOT NULL,

  frequency_description TEXT NOT NULL,

  times_of_day TEXT[],

  start_date DATE,

  end_date DATE,

  is_as_needed BOOLEAN NOT NULL DEFAULT FALSE,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  confirmed_currently_taking BOOLEAN NOT NULL DEFAULT FALSE,

  confirmed_at TIMESTAMPTZ,

  source_prescription_revision INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_med_schedules_owner ON medication_schedules(owner_id);

ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "med_schedules_select_own" ON medication_schedules

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "med_schedules_insert_own" ON medication_schedules

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "med_schedules_update_own" ON medication_schedules

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "med_schedules_delete_own" ON medication_schedules

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- MEDICATION LOGS

-- ============================================================

CREATE TABLE medication_logs (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  schedule_id UUID NOT NULL REFERENCES medication_schedules(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  scheduled_date DATE NOT NULL,

  scheduled_time TEXT,

  action TEXT NOT NULL CHECK (action IN ('taken', 'skipped')),

  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE UNIQUE INDEX uq_medication_logs_schedule_date_time
  ON medication_logs (schedule_id, scheduled_date, COALESCE(scheduled_time, ''));

CREATE INDEX idx_med_logs_owner ON medication_logs(owner_id, scheduled_date);

CREATE INDEX idx_med_logs_schedule ON medication_logs(schedule_id, scheduled_date);

ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "med_logs_select_own" ON medication_logs

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "med_logs_insert_own" ON medication_logs

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "med_logs_update_own" ON medication_logs

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "med_logs_delete_own" ON medication_logs

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- FOLLOWUPS

-- ============================================================

CREATE TYPE followup_status AS ENUM ('pending', 'completed', 'cancelled');

CREATE TABLE followups (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  instruction_text TEXT NOT NULL,

  source_passage TEXT,

  page_number INT,

  proposed_date DATE,

  anchor_date DATE,

  confirmed_date DATE,

  status followup_status NOT NULL DEFAULT 'pending',

  patient_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

  confirmed_at TIMESTAMPTZ,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_followups_owner ON followups(owner_id, status);

ALTER TABLE followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followups_select_own" ON followups

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "followups_insert_own" ON followups

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "followups_update_own" ON followups

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "followups_delete_own" ON followups

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- SYMPTOM ENTRIES (DIARY)

-- ============================================================

CREATE TABLE symptom_entries (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  description TEXT NOT NULL,

  onset_date DATE,

  severity INT CHECK (severity BETWEEN 1 AND 10),

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_symptoms_owner ON symptom_entries(owner_id, onset_date DESC);

ALTER TABLE symptom_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "symptoms_select_own" ON symptom_entries

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "symptoms_insert_own" ON symptom_entries

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "symptoms_update_own" ON symptom_entries

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "symptoms_delete_own" ON symptom_entries

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- SAVED QUESTIONS

-- ============================================================

CREATE TABLE saved_questions (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  question_text TEXT NOT NULL,

  source TEXT CHECK (source IN ('chat', 'explanation', 'manual')),

  is_addressed BOOLEAN NOT NULL DEFAULT FALSE,

  addressed_at TIMESTAMPTZ,

  include_in_brief BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_questions_owner ON saved_questions(owner_id, is_addressed);

ALTER TABLE saved_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions_select_own" ON saved_questions

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "questions_insert_own" ON saved_questions

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "questions_update_own" ON saved_questions

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "questions_delete_own" ON saved_questions

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- CHAT THREADS

-- ============================================================

CREATE TABLE chat_threads (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title TEXT,

  mode TEXT NOT NULL DEFAULT 'cross_record' CHECK (mode IN ('single_record', 'cross_record')),

  selected_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

  message_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_threads_owner ON chat_threads(owner_id, updated_at DESC);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads_select_own" ON chat_threads

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "threads_insert_own" ON chat_threads

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "threads_update_own" ON chat_threads

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "threads_delete_own" ON chat_threads

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- CHAT MESSAGES

-- ============================================================

CREATE TABLE chat_messages (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),

  content TEXT NOT NULL,

  answer_type TEXT CHECK (answer_type IN ('record_based', 'general_explanation', 'missing_info', 'error', 'emergency_notice')),

  context_truncated BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_messages_thread ON chat_messages(thread_id, created_at ASC);

CREATE INDEX idx_messages_owner ON chat_messages(owner_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_own" ON chat_messages

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "messages_insert_own" ON chat_messages

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "messages_delete_own" ON chat_messages

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- CHAT MESSAGE SOURCES (Citations)

-- ============================================================

CREATE TABLE chat_message_sources (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,

  page_number INT,

  source_passage TEXT,

  citation_label TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_sources_message ON chat_message_sources(message_id);

ALTER TABLE chat_message_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sources_select_own" ON chat_message_sources

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "sources_insert_own" ON chat_message_sources

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "sources_delete_own" ON chat_message_sources

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- VISIT BRIEFS

-- ============================================================

CREATE TABLE visit_briefs (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title TEXT NOT NULL,

  language TEXT NOT NULL CHECK (language IN ('en', 'te', 'hi')),

  reason_for_visit TEXT,

  recorded_results TEXT,

  compatible_changes TEXT,

  confirmed_medicines TEXT,

  reported_symptoms TEXT,

  unresolved_issues TEXT,

  questions TEXT,

  raw_content JSONB,

  patient_edited BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX idx_briefs_owner ON visit_briefs(owner_id, created_at DESC);

ALTER TABLE visit_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefs_select_own" ON visit_briefs

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "briefs_insert_own" ON visit_briefs

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "briefs_update_own" ON visit_briefs

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "briefs_delete_own" ON visit_briefs

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- BRIEF SOURCES

-- ============================================================

CREATE TABLE brief_sources (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  brief_id UUID NOT NULL REFERENCES visit_briefs(id) ON DELETE CASCADE,

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

  source_type TEXT NOT NULL CHECK (source_type IN ('lab_result', 'prescription', 'symptom', 'question', 'followup')),

  source_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

ALTER TABLE brief_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brief_sources_select_own" ON brief_sources

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "brief_sources_insert_own" ON brief_sources

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "brief_sources_delete_own" ON brief_sources

  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================

-- CHAT RATE LIMITS

-- ============================================================

CREATE TABLE chat_rate_limits (

  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  daily_message_count INT NOT NULL DEFAULT 0,

  daily_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,

  total_message_count INT NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_select_own" ON chat_rate_limits

  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "rate_limits_insert_own" ON chat_rate_limits

  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "rate_limits_update_own" ON chat_rate_limits

  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ============================================================

-- UPDATED_AT TRIGGER FUNCTION

-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()

RETURNS TRIGGER LANGUAGE plpgsql AS $$

BEGIN

  NEW.updated_at = NOW();

  RETURN NEW;

END;

$$;

-- Apply to all tables with updated_at

DO $$

DECLARE

  t TEXT;

BEGIN

  FOREACH t IN ARRAY ARRAY[

    'profiles', 'documents', 'processing_jobs', 'lab_results',

    'prescriptions', 'prescription_items', 'explanations',

    'medication_schedules', 'followups', 'symptom_entries',

    'saved_questions', 'chat_threads', 'visit_briefs', 'chat_rate_limits'

  ]

  LOOP

    EXECUTE format(

      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',

      'set_' || t || '_updated_at', t

    );

  END LOOP;

END;

$$;

COMMIT;
