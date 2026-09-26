// Database type definitions matching the SQL schema
// Generated manually to match migrations/001_initial_schema.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DocumentStatus = 'uploaded' | 'processing' | 'needs_review' | 'ready' | 'failed' | 'deleting';
export type DocumentCategory = 'lab_report' | 'prescription' | 'discharge_summary' | 'other' | 'unclassified';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ReviewStatus = 'unreviewed' | 'reviewed' | 'uncertain' | 'corrected';
export type FollowupStatus = 'pending' | 'completed' | 'cancelled';
export type Language = 'en' | 'te' | 'hi';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          preferred_language: Language;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          preferred_language?: Language;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          preferred_language?: Language;
          timezone?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          owner_id: string;
          filename: string;
          mime_type: string;
          size_bytes: number;
          page_count: number | null;
          storage_path: string;
          sha256_hash: string;
          status: DocumentStatus;
          category: DocumentCategory;
          report_date: string | null;
          extracted_patient_name: string | null;
          patient_name_mismatch: boolean;
          review_status: string;
          revision: number;
          idempotency_key: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          filename: string;
          mime_type: string;
          size_bytes: number;
          page_count?: number | null;
          storage_path: string;
          sha256_hash: string;
          status?: DocumentStatus;
          category?: DocumentCategory;
          report_date?: string | null;
          extracted_patient_name?: string | null;
          patient_name_mismatch?: boolean;
          review_status?: string;
          revision?: number;
          idempotency_key?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
      document_pages: {
        Row: {
          id: string;
          document_id: string;
          owner_id: string;
          page_number: number;
          page_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          owner_id: string;
          page_number: number;
          page_text?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['document_pages']['Insert']>;
      };
      processing_jobs: {
        Row: {
          id: string;
          document_id: string;
          owner_id: string;
          status: JobStatus;
          attempt_count: number;
          max_attempts: number;
          error_category: string | null;
          error_message: string | null;
          heartbeat_at: string | null;
          lock_expires_at: string | null;
          revision: number;
          idempotency_key: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          owner_id: string;
          status?: JobStatus;
          attempt_count?: number;
          max_attempts?: number;
          error_category?: string | null;
          error_message?: string | null;
          heartbeat_at?: string | null;
          lock_expires_at?: string | null;
          revision?: number;
          idempotency_key: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['processing_jobs']['Insert']>;
      };
      lab_results: {
        Row: {
          id: string;
          document_id: string;
          owner_id: string;
          original_label: string;
          normalised_name: string | null;
          result_text: string | null;
          result_numeric: number | null;
          unit: string | null;
          original_range: string | null;
          range_low: number | null;
          range_high: number | null;
          report_date: string | null;
          page_number: number | null;
          source_passage: string | null;
          uncertainty_reason: string | null;
          review_status: ReviewStatus;
          reviewed_at: string | null;
          revision: number;
          extraction_revision: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['lab_results']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['lab_results']['Insert']>;
      };
      prescriptions: {
        Row: {
          id: string;
          document_id: string;
          owner_id: string;
          prescriber_name: string | null;
          prescriber_date: string | null;
          review_status: ReviewStatus;
          reviewed_at: string | null;
          revision: number;
          extraction_revision: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['prescriptions']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['prescriptions']['Insert']>;
      };
      prescription_items: {
        Row: {
          id: string;
          prescription_id: string;
          document_id: string;
          owner_id: string;
          original_medicine_name: string;
          strength: string | null;
          dose: string | null;
          route: string | null;
          frequency: string | null;
          duration: string | null;
          meal_instructions: string | null;
          page_number: number | null;
          source_passage: string | null;
          missing_fields: string[] | null;
          uncertain_fields: string[] | null;
          review_status: ReviewStatus;
          reviewed_at: string | null;
          revision: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['prescription_items']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['prescription_items']['Insert']>;
      };
      explanations: {
        Row: {
          id: string;
          document_id: string;
          owner_id: string;
          language: Language;
          what_it_says: string | null;
          what_terms_mean: string | null;
          questions_for_appointment: string | null;
          document_revision: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['explanations']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['explanations']['Insert']>;
      };
      medication_schedules: {
        Row: {
          id: string;
          prescription_item_id: string;
          owner_id: string;
          medicine_name: string;
          dose: string;
          frequency_description: string;
          times_of_day: string[] | null;
          start_date: string | null;
          end_date: string | null;
          is_as_needed: boolean;
          is_active: boolean;
          confirmed_currently_taking: boolean;
          confirmed_at: string | null;
          source_prescription_revision: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['medication_schedules']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['medication_schedules']['Insert']>;
      };
      medication_logs: {
        Row: {
          id: string;
          schedule_id: string;
          owner_id: string;
          scheduled_date: string;
          scheduled_time: string | null;
          action: 'taken' | 'skipped';
          logged_at: string;
        };
        Insert: Omit<Database['public']['Tables']['medication_logs']['Row'], 'id' | 'logged_at'> & {
          id?: string;
          logged_at?: string;
        };
        Update: Partial<Database['public']['Tables']['medication_logs']['Insert']>;
      };
      followups: {
        Row: {
          id: string;
          document_id: string | null;
          owner_id: string;
          instruction_text: string;
          source_passage: string | null;
          page_number: number | null;
          proposed_date: string | null;
          anchor_date: string | null;
          confirmed_date: string | null;
          status: FollowupStatus;
          patient_confirmed: boolean;
          confirmed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['followups']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['followups']['Insert']>;
      };
      symptom_entries: {
        Row: {
          id: string;
          owner_id: string;
          description: string;
          onset_date: string | null;
          severity: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['symptom_entries']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['symptom_entries']['Insert']>;
      };
      saved_questions: {
        Row: {
          id: string;
          owner_id: string;
          question_text: string;
          source: 'chat' | 'explanation' | 'manual' | null;
          is_addressed: boolean;
          addressed_at: string | null;
          include_in_brief: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['saved_questions']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['saved_questions']['Insert']>;
      };
      chat_threads: {
        Row: {
          id: string;
          owner_id: string;
          title: string | null;
          mode: 'single_record' | 'cross_record';
          selected_document_id: string | null;
          message_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_threads']['Row'], 'id' | 'created_at' | 'updated_at' | 'message_count'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          message_count?: number;
        };
        Update: Partial<Database['public']['Tables']['chat_threads']['Insert']>;
      };
      chat_messages: {
        Row: {
          id: string;
          thread_id: string;
          owner_id: string;
          role: 'user' | 'assistant';
          content: string;
          answer_type: 'record_based' | 'general_explanation' | 'missing_info' | 'error' | 'emergency_notice' | null;
          context_truncated: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_messages']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
      };
      chat_message_sources: {
        Row: {
          id: string;
          message_id: string;
          owner_id: string;
          document_id: string | null;
          page_number: number | null;
          source_passage: string | null;
          citation_label: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_message_sources']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
      };
      visit_briefs: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          language: Language;
          reason_for_visit: string | null;
          recorded_results: string | null;
          compatible_changes: string | null;
          confirmed_medicines: string | null;
          reported_symptoms: string | null;
          unresolved_issues: string | null;
          questions: string | null;
          raw_content: Json | null;
          patient_edited: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['visit_briefs']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['visit_briefs']['Insert']>;
      };
      chat_rate_limits: {
        Row: {
          id: string;
          owner_id: string;
          daily_message_count: number;
          daily_reset_at: string;
          total_message_count: number;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_rate_limits']['Row'], 'id' | 'updated_at'> & {
          id?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['chat_rate_limits']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      document_status: DocumentStatus;
      document_category: DocumentCategory;
      job_status: JobStatus;
      review_status: ReviewStatus;
      followup_status: FollowupStatus;
    };
  };
}
