import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';
import {generateVisitBrief, GroqConfigError, GroqProviderError} from '@/lib/ai/groq-chat';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    
    const body = await request.json();
    const {locale = 'en'} = body;
    
    // Fetch all necessary data
    
    // 1. Reviewed lab results (recent)
    const {data: labResults} = await supabase
      .from('lab_results')
      .select('*')
      .eq('owner_id', user.id)
      .in('review_status', ['reviewed', 'corrected'])
      .order('report_date', {ascending: false})
      .limit(50);
      
    // 2. Prescription items (current/reviewed)
    const {data: prescItems} = await supabase
      .from('prescription_items')
      .select('*')
      .eq('owner_id', user.id)
      .in('review_status', ['reviewed', 'corrected'])
      .limit(30);
      
    // 3. Symptoms
    const {data: symptoms} = await supabase
      .from('symptom_entries')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', {ascending: false})
      .limit(20);
      
    // 5. Questions explicitly marked for brief
    const {data: questions} = await supabase
      .from('saved_questions')
      .select('*')
      .eq('owner_id', user.id)
      .eq('include_in_brief', true)
      .eq('is_addressed', false);

    // Call Groq to generate brief
    let briefResult;
    try {
      briefResult = await generateVisitBrief({
        lab_results: (labResults as any) || [],
        prescription_items: (prescItems as any) || [],
        symptoms: (symptoms as any) || [],
        followups: [],
        questions: (questions || []).map((q: any) => q.question_text),
      }, locale as 'en' | 'te' | 'hi');
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
    
    return NextResponse.json({brief: briefResult});
    
  } catch (error) {
    const err = error as Error;
    if (err.message === 'Not authenticated') {
      return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    }
    console.error('Visit brief error:', err.name);
    return NextResponse.json({error: 'Failed to generate visit brief'}, {status: 500});
  }
}
