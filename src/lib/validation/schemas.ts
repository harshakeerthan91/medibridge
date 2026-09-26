import {z} from 'zod';

// ============================================================
// Auth form schemas
// ============================================================
export const LoginSchema = z.object({
  email: z.string().email({message: 'Please enter a valid email address.'}),
  password: z.string().min(8, {message: 'Password must be at least 8 characters.'}),
});

export const SignupSchema = z.object({
  email: z.string().email({message: 'Please enter a valid email address.'}),
  password: z.string().min(8, {message: 'Password must be at least 8 characters.'}),
  confirm_password: z.string(),
  full_name: z.string().optional(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match.',
  path: ['confirm_password'],
});

export const ResetPasswordSchema = z.object({
  email: z.string().email({message: 'Please enter a valid email address.'}),
});

export const UpdatePasswordSchema = z.object({
  password: z.string().min(8, {message: 'Password must be at least 8 characters.'}),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match.',
  path: ['confirm_password'],
});

// ============================================================
// Document upload validation
// ============================================================
export const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'] as const;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PAGES = 10;

export const UploadedFileSchema = z.object({
  name: z.string(),
  size: z.number().max(MAX_FILE_SIZE_BYTES, {message: 'File must be under 10 MB.'}),
  type: z.enum(ACCEPTED_MIME_TYPES, {message: 'Only PDF, JPG, and PNG files are accepted.'}),
});

// ============================================================
// Profile schemas
// ============================================================
export const ProfileUpdateSchema = z.object({
  full_name: z.string().max(200).optional(),
  preferred_language: z.enum(['en', 'te', 'hi']).optional(),
  timezone: z.string().max(100).optional(),
});

// ============================================================
// Symptom diary schemas
// ============================================================
export const SymptomEntrySchema = z.object({
  description: z.string().min(1, {message: 'Please describe the symptom.'}).max(1000),
  onset_date: z.string().optional().nullable(),
  severity: z.number().int().min(1).max(10).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ============================================================
// Saved question schemas
// ============================================================
export const SavedQuestionSchema = z.object({
  question_text: z.string().min(1, {message: 'Please enter a question.'}).max(1000),
  source: z.enum(['chat', 'explanation', 'manual']).optional().default('manual'),
  include_in_brief: z.boolean().optional().default(false),
});

// ============================================================
// Follow-up schemas
// ============================================================
export const FollowupSchema = z.object({
  instruction_text: z.string().min(1).max(1000),
  proposed_date: z.string().optional().nullable(),
  anchor_date: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ============================================================
// Chat request schemas
// ============================================================
export const ChatRequestSchema = z.object({
  thread_id: z.string().uuid().optional(),
  message: z.string().min(1, {message: 'Message cannot be empty.'}).max(2000),
  mode: z.enum(['single_record', 'cross_record']).default('cross_record'),
  document_id: z.string().uuid().optional().nullable(),
  locale: z.enum(['en', 'te', 'hi']).default('en'),
});

// ============================================================
// Medication log schema
// ============================================================
export const MedicationLogSchema = z.object({
  schedule_id: z.string().uuid(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_time: z.string().optional().nullable(),
  action: z.enum(['taken', 'skipped']),
});

// ============================================================
// Lab result correction schema
// ============================================================
export const LabResultCorrectionSchema = z.object({
  result_text: z.string().max(200).optional().nullable(),
  result_numeric: z.number().optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  original_range: z.string().max(100).optional().nullable(),
  range_low: z.number().optional().nullable(),
  range_high: z.number().optional().nullable(),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// ============================================================
// Type exports
// ============================================================
export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
export type SymptomEntryInput = z.infer<typeof SymptomEntrySchema>;
export type SavedQuestionInput = z.infer<typeof SavedQuestionSchema>;
export type FollowupInput = z.infer<typeof FollowupSchema>;
export type ChatRequestInput = z.infer<typeof ChatRequestSchema>;
export type MedicationLogInput = z.infer<typeof MedicationLogSchema>;
export type LabResultCorrectionInput = z.infer<typeof LabResultCorrectionSchema>;
