import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';
import {extractMedicalDocument, GeminiConfigError, GeminiExtractionError} from '@/lib/ai/gemini-extraction';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PAGES = 10;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    
    const body = await request.json();
    const {document_id, idempotency_key} = body;
    
    if (!document_id || !idempotency_key) {
      return NextResponse.json({error: 'document_id and idempotency_key are required'}, {status: 400});
    }
    
    // Verify document ownership
    const {data: document} = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .eq('owner_id', user.id)
      .single();
    
    if (!document) {
      return NextResponse.json({error: 'Document not found'}, {status: 404});
    }
    
    if (document.status === 'deleting' || document.deleted_at) {
      return NextResponse.json({error: 'Document is being deleted'}, {status: 410});
    }
    
    // Idempotency: check if job already exists
    const {data: existingJob} = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('idempotency_key', idempotency_key)
      .single();
    
    if (existingJob?.status === 'completed') {
      return NextResponse.json({
        status: 'already_completed',
        job_id: existingJob.id,
      });
    }
    
    if (existingJob?.status === 'running' && existingJob.lock_expires_at) {
      const lockExpiry = new Date(existingJob.lock_expires_at);
      if (lockExpiry > new Date()) {
        return NextResponse.json({
          status: 'already_running',
          job_id: existingJob.id,
        });
      }
    }
    
    // Create or update job
    const jobData = {
      document_id,
      owner_id: user.id,
      idempotency_key,
      status: 'running' as const,
      started_at: new Date().toISOString(),
      lock_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min lock
      heartbeat_at: new Date().toISOString(),
    };
    
    let jobId: string;
    
    if (existingJob) {
      const {data: updatedJob} = await supabase
        .from('processing_jobs')
        .update({
          ...jobData,
          attempt_count: existingJob.attempt_count + 1,
        })
        .eq('id', existingJob.id)
        .select()
        .single();
      jobId = updatedJob?.id || existingJob.id;
    } else {
      const {data: newJob} = await supabase
        .from('processing_jobs')
        .insert(jobData)
        .select()
        .single();
      jobId = newJob?.id || '';
    }
    
    // Update document status
    await supabase
      .from('documents')
      .update({status: 'processing'})
      .eq('id', document_id)
      .eq('owner_id', user.id);
    
    // Get signed URL for the file
    const storagePath = document.storage_path;
    const {data: signedData} = await supabase.storage
      .from('medical-records')
      .createSignedUrl(storagePath, 300); // 5 minute URL
    
    if (!signedData?.signedUrl) {
      await failJob(supabase, jobId, document_id, user.id, 'storage_error', 'Could not access the uploaded file');
      return NextResponse.json({error: 'Failed to access uploaded file'}, {status: 500});
    }
    
    // Download the file for Gemini
    const fileResponse = await fetch(signedData.signedUrl);
    if (!fileResponse.ok) {
      await failJob(supabase, jobId, document_id, user.id, 'storage_error', 'Failed to download file for processing');
      return NextResponse.json({error: 'Failed to download file'}, {status: 500});
    }
    
    const fileBuffer = await fileResponse.arrayBuffer();
    if (fileBuffer.byteLength > MAX_FILE_SIZE) {
      await failJob(supabase, jobId, document_id, user.id, 'file_too_large', 'File exceeds 10 MB limit');
      return NextResponse.json({error: 'File too large'}, {status: 400});
    }
    
    const fileBase64 = Buffer.from(fileBuffer).toString('base64');
    
    // Extract using Gemini
    let extractionResult;
    try {
      extractionResult = await extractMedicalDocument(
        fileBase64,
        document.mime_type,
        document.filename,
      );
    } catch (err) {
      let errorCategory = 'extraction_error';
      let errorMessage = 'Extraction failed';
      
      if (err instanceof GeminiConfigError) {
        errorCategory = 'config_error';
        errorMessage = err.message;
      } else if (err instanceof GeminiExtractionError) {
        errorCategory = err.category;
        errorMessage = err.message;
      }
      
      await failJob(supabase, jobId, document_id, user.id, errorCategory, errorMessage);
      return NextResponse.json({error: errorMessage, category: errorCategory}, {status: 500});
    }
    
    // Validate page count
    if (extractionResult.page_texts.length > MAX_PAGES) {
      await failJob(supabase, jobId, document_id, user.id, 'too_many_pages', `Document has ${extractionResult.page_texts.length} pages, max is ${MAX_PAGES}`);
      return NextResponse.json({error: 'Document has too many pages'}, {status: 400});
    }
    
    // Delete any previous extraction results for this document (for retries)
    await Promise.all([
      supabase.from('document_pages').delete().eq('document_id', document_id).eq('owner_id', user.id),
      supabase.from('lab_results').delete().eq('document_id', document_id).eq('owner_id', user.id),
      supabase.from('prescriptions').delete().eq('document_id', document_id).eq('owner_id', user.id),
    ]);
    
    // Store page texts
    if (extractionResult.page_texts.length > 0) {
      await supabase.from('document_pages').insert(
        extractionResult.page_texts.map(p => ({
          document_id,
          owner_id: user.id,
          page_number: p.page_number,
          page_text: p.text,
        }))
      );
    }
    
    // Store lab results
    if (extractionResult.lab_results && extractionResult.lab_results.length > 0) {
      await supabase.from('lab_results').insert(
        extractionResult.lab_results.map(lab => ({
          document_id,
          owner_id: user.id,
          original_label: lab.original_label,
          normalised_name: lab.normalised_name,
          result_text: lab.result_text,
          result_numeric: lab.result_numeric,
          unit: lab.unit,
          original_range: lab.original_range,
          range_low: lab.range_low,
          range_high: lab.range_high,
          report_date: lab.report_date,
          page_number: lab.page_number,
          source_passage: lab.source_passage,
          uncertainty_reason: lab.uncertainty_reason,
          review_status: 'unreviewed',
          extraction_revision: document.revision,
        }))
      );
    }
    
    // Store prescription items
    if (extractionResult.prescription_items && extractionResult.prescription_items.length > 0) {
      // Create prescription record first
      const {data: prescription} = await supabase.from('prescriptions').insert({
        document_id,
        owner_id: user.id,
        review_status: 'unreviewed',
        extraction_revision: document.revision,
      }).select().single();
      
      if (prescription) {
        await supabase.from('prescription_items').insert(
          extractionResult.prescription_items.map(item => ({
            prescription_id: prescription.id,
            document_id,
            owner_id: user.id,
            original_medicine_name: item.original_medicine_name,
            strength: item.strength,
            dose: item.dose,
            route: item.route,
            frequency: item.frequency,
            duration: item.duration,
            meal_instructions: item.meal_instructions,
            page_number: item.page_number,
            source_passage: item.source_passage,
            missing_fields: item.missing_fields,
            uncertain_fields: item.uncertain_fields,
            review_status: 'unreviewed',
          }))
        );
      }
    }
    
    // Check for patient name mismatch
    let patientNameMismatch = false;
    if (extractionResult.extracted_patient_name) {
      const {data: profile} = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      if (profile?.full_name && extractionResult.extracted_patient_name) {
        const docName = extractionResult.extracted_patient_name.toLowerCase().trim();
        const profileName = profile.full_name.toLowerCase().trim();
        // Simple check: if names share no words, flag as mismatch
        const docWords = new Set(docName.split(/\s+/));
        const profileWords = profileName.split(/\s+/);
        const hasCommon = profileWords.some((w: string) => w.length > 2 && docWords.has(w));
        patientNameMismatch = !hasCommon;
      }
    }
    
    // Update document
    await supabase.from('documents').update({
      status: 'needs_review',
      category: extractionResult.document_category,
      report_date: extractionResult.report_date,
      extracted_patient_name: extractionResult.extracted_patient_name,
      patient_name_mismatch: patientNameMismatch,
      page_count: extractionResult.page_texts.length,
    }).eq('id', document_id).eq('owner_id', user.id);
    
    // Mark job complete
    await supabase.from('processing_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      lock_expires_at: null,
    }).eq('id', jobId);
    
    return NextResponse.json({
      status: 'completed',
      job_id: jobId,
      document_category: extractionResult.document_category,
      lab_results_count: extractionResult.lab_results?.length || 0,
      prescription_items_count: extractionResult.prescription_items?.length || 0,
      page_count: extractionResult.page_texts.length,
      patient_name_mismatch: patientNameMismatch,
    });
    
  } catch (error) {
    const err = error as Error;
    if (err.message === 'Not authenticated') {
      return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    }
    console.error('Extract error:', err.name); // Never log document content
    return NextResponse.json({error: 'Extraction failed'}, {status: 500});
  }
}

async function failJob(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  jobId: string,
  documentId: string,
  ownerId: string,
  errorCategory: string,
  errorMessage: string,
) {
  await Promise.all([
    supabase.from('processing_jobs').update({
      status: 'failed',
      error_category: errorCategory,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      lock_expires_at: null,
    }).eq('id', jobId),
    supabase.from('documents').update({
      status: 'failed',
      error_message: errorMessage,
    }).eq('id', documentId).eq('owner_id', ownerId),
  ]);
}
