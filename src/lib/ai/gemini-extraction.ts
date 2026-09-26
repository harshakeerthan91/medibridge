/**
 * Gemini Document Extraction Adapter
 * 
 * Uses @google/generative-ai SDK to extract structured data from uploaded medical documents.
 * Gemini is the ONLY provider used for document extraction — never Groq.
 * 
 * Verified models: gemini-1.5-flash
 * Reference: https://ai.google.dev/gemini-api/docs/document-processing
 */

import {GoogleGenerativeAI, SchemaType} from '@google/generative-ai';
import {z} from 'zod';

// ============================================================
// Configuration
// ============================================================
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_DOCUMENT_MODEL;

  if (!apiKey) {
    throw new GeminiConfigError('GEMINI_API_KEY is not set. Please configure your Gemini API key.');
  }
  if (!model) {
    throw new GeminiConfigError('GEMINI_DOCUMENT_MODEL is not set. Please configure the model (e.g. gemini-2.0-flash).');
  }

  return {client: new GoogleGenerativeAI(apiKey), model};
}

// ============================================================
// Error types
// ============================================================
export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export class GeminiExtractionError extends Error {
  constructor(message: string, public readonly category: string) {
    super(message);
    this.name = 'GeminiExtractionError';
  }
}

// ============================================================
// Extraction schemas (Zod for runtime validation)
// ============================================================
export const LabResultSchema = z.object({
  original_label: z.string(),
  normalised_name: z.string().nullable(),
  result_text: z.string().nullable(),
  result_numeric: z.number().nullable(),
  unit: z.string().nullable(),
  original_range: z.string().nullable(),
  range_low: z.number().nullable(),
  range_high: z.number().nullable(),
  report_date: z.string().nullable().describe('ISO date YYYY-MM-DD if clearly readable, otherwise null'),
  page_number: z.number().int().nullable(),
  source_passage: z.string().nullable().describe('Verbatim text from the document supporting this value'),
  uncertainty_reason: z.string().nullable().describe('Why this field is uncertain or null'),
});

export const PrescriptionItemSchema = z.object({
  original_medicine_name: z.string(),
  strength: z.string().nullable(),
  dose: z.string().nullable(),
  route: z.string().nullable(),
  frequency: z.string().nullable(),
  duration: z.string().nullable(),
  meal_instructions: z.string().nullable(),
  page_number: z.number().int().nullable(),
  source_passage: z.string().nullable(),
  missing_fields: z.array(z.string()).nullable().describe('Field names that are blank/missing'),
  uncertain_fields: z.array(z.string()).nullable().describe('Field names that are ambiguous'),
});

export const ExtractionResultSchema = z.object({
  document_category: z.enum(['lab_report', 'prescription', 'discharge_summary', 'other']),
  report_date: z.string().nullable().describe('ISO date of the report if clearly readable, otherwise null'),
  extracted_patient_name: z.string().nullable(),
  lab_results: z.array(LabResultSchema).nullable(),
  prescription_items: z.array(PrescriptionItemSchema).nullable(),
  page_texts: z.array(z.object({
    page_number: z.number().int(),
    text: z.string(),
  })),
  processing_notes: z.string().nullable().describe('Any issues encountered during extraction'),
});

export type LabResult = z.infer<typeof LabResultSchema>;
export type PrescriptionItem = z.infer<typeof PrescriptionItemSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ============================================================
// Main extraction function
// ============================================================
/**
 * Extract structured medical data from a document.
 * 
 * @param fileData - Base64-encoded file content
 * @param mimeType - MIME type of the file
 * @param filename - Original filename for context
 * @returns Structured extraction result
 */
export async function extractMedicalDocument(
  fileData: string,
  mimeType: string,
  filename: string,
): Promise<ExtractionResult> {
  const {client, model: modelId} = getGeminiClient();

  const model = client.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const systemPrompt = `You are a precise medical document extraction assistant. Your task is to extract structured data from medical documents.

CRITICAL RULES:
- Never invent, infer, or guess values not clearly written in the document
- Leave fields null if the information is missing, ambiguous, or illegible
- For dates: only extract if unambiguously readable (e.g. "15 Jan 2024" → "2024-01-15"); otherwise null
- For numeric results: preserve as text if they include inequalities (e.g. ">5.0" stays as text, not coerced to 5.0)
- For reference ranges: extract the original printed text AND parse numeric bounds only if unambiguous
- List all missing or uncertain fields explicitly
- Extract verbatim source passages that support each extracted value
- Do NOT make medical interpretations or diagnoses
- Treat each page separately and record page numbers`;

  const userPrompt = `Extract all structured medical data from this document: "${filename}"

Return a JSON object with this exact structure:
{
  "document_category": "lab_report" | "prescription" | "discharge_summary" | "other",
  "report_date": "YYYY-MM-DD or null",
  "extracted_patient_name": "string or null",
  "lab_results": [...] or null,
  "prescription_items": [...] or null,
  "page_texts": [{"page_number": 1, "text": "..."}],
  "processing_notes": "string or null"
}

For lab_results (each item):
{
  "original_label": "exact label from document",
  "normalised_name": "conservative standardised name or null",
  "result_text": "the result as text (preserving inequalities)",
  "result_numeric": numeric value or null,
  "unit": "unit or null",
  "original_range": "printed range text or null",
  "range_low": numeric or null,
  "range_high": numeric or null,
  "report_date": "YYYY-MM-DD or null",
  "page_number": integer or null,
  "source_passage": "verbatim excerpt or null",
  "uncertainty_reason": "explanation if uncertain or null"
}

For prescription_items (each item):
{
  "original_medicine_name": "exact name as written",
  "strength": "e.g. 500mg or null",
  "dose": "e.g. 1 tablet or null",
  "route": "e.g. oral or null",
  "frequency": "exact frequency as written or null",
  "duration": "e.g. 7 days or null",
  "meal_instructions": "e.g. after food or null",
  "page_number": integer or null,
  "source_passage": "verbatim excerpt or null",
  "missing_fields": ["field_name", ...] or null,
  "uncertain_fields": ["field_name", ...] or null
}`;

  try {
    const result = await model.generateContent([
      {text: systemPrompt},
      {
        inlineData: {
          mimeType,
          data: fileData,
        },
      },
      {text: userPrompt},
    ]);

    const responseText = result.response.text();
    
    // Parse and validate
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new GeminiExtractionError(
        'Gemini returned invalid JSON. The document may be unreadable.',
        'parse_error'
      );
    }

    const validated = ExtractionResultSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('Gemini schema validation failed:', validated.error.errors);
      // Attempt graceful partial extraction
      return coercePartialResult(parsed);
    }

    return validated.data;
  } catch (error) {
    if (error instanceof GeminiConfigError || error instanceof GeminiExtractionError) {
      throw error;
    }

    const err = error as Error & {status?: number; message?: string};
    
    if (err.status === 401 || err.message?.includes('API_KEY_INVALID')) {
      throw new GeminiExtractionError('Gemini API key is invalid or expired.', 'auth_error');
    }
    if (err.status === 429 || err.message?.includes('QUOTA_EXCEEDED')) {
      throw new GeminiExtractionError('Gemini API quota exceeded. Please try again later.', 'quota_error');
    }
    if (err.message?.includes('SAFETY')) {
      throw new GeminiExtractionError('Document was blocked by safety filters. Please check the file.', 'safety_error');
    }

    throw new GeminiExtractionError(
      `Gemini extraction failed: ${err.message || 'Unknown error'}`,
      'extraction_error'
    );
  }
}

/**
 * Gracefully handle partial extraction results when schema validation fails.
 */
function coercePartialResult(raw: unknown): ExtractionResult {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    document_category: (obj.document_category as ExtractionResult['document_category']) || 'other',
    report_date: (obj.report_date as string) || null,
    extracted_patient_name: (obj.extracted_patient_name as string) || null,
    lab_results: Array.isArray(obj.lab_results) ? [] : null,
    prescription_items: Array.isArray(obj.prescription_items) ? [] : null,
    page_texts: Array.isArray(obj.page_texts) ? (obj.page_texts as {page_number: number; text: string}[]) : [],
    processing_notes: 'Partial extraction — some fields could not be validated.',
  };
}
