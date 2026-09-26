import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';
import {explainReviewedRecord, GroqConfigError, GroqProviderError} from '@/lib/ai/groq-chat';
import type {Language} from '@/lib/supabase/types';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    
    const body = await request.json();
    const {document_id, locale = 'en'} = body;
    
    if (!document_id) {
      return NextResponse.json({error: 'document_id is required'}, {status: 400});
    }
    
    const validLocales: Language[] = ['en', 'te', 'hi'];
    const safeLocale: Language = validLocales.includes(locale) ? locale : 'en';
    
    // Verify document ownership
    const {data: document} = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .single();
    
    if (!document) {
      return NextResponse.json({error: 'Document not found'}, {status: 404});
    }
    
    // Check for cached explanation at this revision and language
    const {data: cached} = await supabase
      .from('explanations')
      .select('*')
      .eq('document_id', document_id)
      .eq('owner_id', user.id)
      .eq('language', safeLocale)
      .eq('document_revision', document.revision)
      .single();
    
    if (cached) {
      return NextResponse.json({
        explanation: cached,
        cached: true,
      });
    }
    
    // Retrieve reviewed lab results and prescription items
    const {data: labResults} = await supabase
      .from('lab_results')
      .select('*')
      .eq('document_id', document_id)
      .eq('owner_id', user.id)
      .in('review_status', ['reviewed', 'corrected'])
      .limit(50);
    
    const {data: prescItems} = await supabase
      .from('prescription_items')
      .select('*')
      .eq('document_id', document_id)
      .eq('owner_id', user.id)
      .in('review_status', ['reviewed', 'corrected'])
      .limit(30);
    
    if (!labResults?.length && !prescItems?.length) {
      return NextResponse.json({
        error: 'No reviewed data found. Please review the extracted information first.',
        code: 'no_reviewed_data',
      }, {status: 422});
    }
    
    // Generate explanation using Groq
    let explanationResult;
    try {
      explanationResult = await explainReviewedRecord(
        (labResults || []) as Parameters<typeof explainReviewedRecord>[0],
        (prescItems || []) as Parameters<typeof explainReviewedRecord>[1],
        document.filename,
        safeLocale,
      );
    } catch (err) {
      if (err instanceof GroqConfigError) {
        return NextResponse.json({
          error: 'AI service is not configured. Please set up GROQ_API_KEY and GROQ_CHAT_MODEL.',
          code: 'config_error',
        }, {status: 503});
      }
      if (err instanceof GroqProviderError) {
        const statusCode = err.category === 'quota_error' ? 429 : 503;
        return NextResponse.json({
          error: err.message,
          code: err.category,
        }, {status: statusCode});
      }
      throw err;
    }
    
    // Cache the explanation
    const {data: savedExplanation} = await supabase
      .from('explanations')
      .upsert({
        document_id,
        owner_id: user.id,
        language: safeLocale,
        what_it_says: explanationResult.what_it_says,
        what_terms_mean: explanationResult.what_terms_mean,
        questions_for_appointment: explanationResult.questions_for_appointment,
        document_revision: document.revision,
      }, {onConflict: 'document_id,language,document_revision'})
      .select()
      .single();
    
    return NextResponse.json({
      explanation: savedExplanation,
      citations: explanationResult.citations,
      cached: false,
    });
    
  } catch (error) {
    const err = error as Error;
    if (err.message === 'Not authenticated') {
      return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    }
    console.error('Explain error:', err.name);
    return NextResponse.json({error: 'Failed to generate explanation'}, {status: 500});
  }
}
