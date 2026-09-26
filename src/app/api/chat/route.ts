import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';

const DAILY_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    
    const {searchParams} = new URL(request.url);
    const threadId = searchParams.get('thread_id');
    
    if (threadId) {
      // Get messages for a specific thread
      const {data: thread} = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', threadId)
        .eq('owner_id', user.id)
        .single();
      
      if (!thread) {
        return NextResponse.json({error: 'Thread not found'}, {status: 404});
      }
      
      const {data: messages} = await supabase
        .from('chat_messages')
        .select('*, chat_message_sources(*)')
        .eq('thread_id', threadId)
        .order('created_at', {ascending: true})
        .limit(50);
      
      return NextResponse.json({messages: messages || []});
    }
    
    // Get all threads for user
    const {data: threads} = await supabase
      .from('chat_threads')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', {ascending: false})
      .limit(20);
    
    return NextResponse.json({threads: threads || []});
  } catch (error) {
    const err = error as Error;
    if (err.message === 'Not authenticated') {
      return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    }
    return NextResponse.json({error: 'Failed to fetch chat data'}, {status: 500});
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    
    const body = await request.json();
    const {message, thread_id, mode = 'cross_record', document_id, locale = 'en'} = body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({error: 'Message is required'}, {status: 400});
    }
    
    if (message.length > 2000) {
      return NextResponse.json({error: 'Message is too long'}, {status: 400});
    }
    
    // Rate limit check
    const today = new Date().toISOString().split('T')[0];
    let {data: rateLimit} = await supabase
      .from('chat_rate_limits')
      .select('*')
      .eq('owner_id', user.id)
      .single();
    
    if (rateLimit) {
      if (rateLimit.daily_reset_at !== today) {
        await supabase.from('chat_rate_limits').update({
          daily_message_count: 0,
          daily_reset_at: today,
        }).eq('owner_id', user.id);
        rateLimit.daily_message_count = 0;
      }
      
      if (rateLimit.daily_message_count >= DAILY_LIMIT) {
        return NextResponse.json({error: 'Daily message limit reached. Please try again tomorrow.'}, {status: 429});
      }
    } else {
      await supabase.from('chat_rate_limits').insert({
        owner_id: user.id,
        daily_message_count: 0,
        daily_reset_at: today,
        total_message_count: 0,
      });
    }
    
    // Get or create thread
    let threadDbId = thread_id;
    if (!threadDbId) {
      const {data: newThread} = await supabase
        .from('chat_threads')
        .insert({
          owner_id: user.id,
          mode,
          selected_document_id: document_id || null,
        })
        .select()
        .single();
      
      threadDbId = newThread?.id;
    } else {
      // Verify thread ownership
      const {data: existingThread} = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', threadDbId)
        .eq('owner_id', user.id)
        .single();
      
      if (!existingThread) {
        return NextResponse.json({error: 'Thread not found'}, {status: 404});
      }
    }
    
    if (!threadDbId) {
      return NextResponse.json({error: 'Failed to create conversation'}, {status: 500});
    }
    
    // Save user message
    const {data: userMsg} = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadDbId,
        owner_id: user.id,
        role: 'user',
        content: message,
      })
      .select()
      .single();
    
    // Retrieve authorised context
    let labResults: Record<string, unknown>[] = [];
    let prescriptionItems: Record<string, unknown>[] = [];
    
    if (mode === 'single_record' && document_id) {
      // Verify document ownership before retrieving
      const {data: doc} = await supabase
        .from('documents')
        .select('id')
        .eq('id', document_id)
        .eq('owner_id', user.id)
        .single();
      
      if (doc) {
        const {data: labs} = await supabase
          .from('lab_results')
          .select('*')
          .eq('document_id', document_id)
          .eq('owner_id', user.id)
          .eq('review_status', 'reviewed')
          .limit(50);
        
        const {data: presc} = await supabase
          .from('prescription_items')
          .select('*')
          .eq('document_id', document_id)
          .eq('owner_id', user.id)
          .eq('review_status', 'reviewed')
          .limit(50);
        
        labResults = labs || [];
        prescriptionItems = presc || [];
      }
    } else {
      // Cross-record: retrieve reviewed data for all user's records
      const {data: labs} = await supabase
        .from('lab_results')
        .select('*')
        .eq('owner_id', user.id)
        .eq('review_status', 'reviewed')
        .order('report_date', {ascending: false})
        .limit(80);
      
      const {data: presc} = await supabase
        .from('prescription_items')
        .select('*')
        .eq('owner_id', user.id)
        .eq('review_status', 'reviewed')
        .limit(40);
      
      labResults = labs || [];
      prescriptionItems = presc || [];
    }
    
    // Get conversation history
    const {data: history} = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', threadDbId)
      .order('created_at', {ascending: false})
      .limit(10);
    
    const historyOrdered = (history || []).reverse().slice(0, -1); // exclude the just-inserted user msg
    
    // Import and call Groq
    const {answerFromRecords, GroqConfigError, GroqProviderError} = await import('@/lib/ai/groq-chat');
    
    let answerResult;
    let answerType: 'record_based' | 'general_explanation' | 'missing_info' | 'error' | 'emergency_notice' = 'record_based';
    let answerContent = '';
    let contextTruncated = false;
    
    try {
      answerResult = await answerFromRecords(
        message,
        {
          lab_results: labResults as any,
          prescription_items: prescriptionItems as any,
          document_filenames: {},
        },
        historyOrdered,
        locale as 'en' | 'te' | 'hi',
      );
      
      answerContent = answerResult.answer;
      answerType = answerResult.answer_type;
      contextTruncated = answerResult.context_truncated;
    } catch (err) {
      if (err instanceof GroqConfigError) {
        answerContent = 'AI service is not configured. Please set up GROQ_API_KEY and GROQ_CHAT_MODEL.';
        answerType = 'error';
      } else if (err instanceof GroqProviderError) {
        answerContent = `AI service error: ${err.message}`;
        answerType = 'error';
      } else {
        answerContent = 'An unexpected error occurred. Please try again.';
        answerType = 'error';
      }
    }
    
    // Save assistant message
    const {data: assistantMsg} = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadDbId,
        owner_id: user.id,
        role: 'assistant',
        content: answerContent,
        answer_type: answerType,
        context_truncated: contextTruncated,
      })
      .select()
      .single();
    
    // Save citations (if answer was record-based)
    if (answerResult?.citations && assistantMsg?.id) {
      const validCitations = answerResult.citations.filter(c => c.citation_id);
      if (validCitations.length > 0) {
        await supabase.from('chat_message_sources').insert(
          validCitations.map(c => ({
            message_id: assistantMsg.id,
            owner_id: user.id,
            document_id: c.document_id || null,
            page_number: c.page_number || null,
            source_passage: c.source_passage || null,
            citation_label: c.citation_id,
          }))
        );
      }
    }
    
    // Update rate limits
    await supabase.from('chat_rate_limits').upsert({
      owner_id: user.id,
      daily_message_count: (rateLimit?.daily_message_count || 0) + 1,
      daily_reset_at: today,
      total_message_count: (rateLimit?.total_message_count || 0) + 1,
    }, {onConflict: 'owner_id'});
    
    // Update thread
    await supabase.from('chat_threads').update({
      updated_at: new Date().toISOString(),
      message_count: (await supabase.from('chat_messages').select('id', {count: 'exact'}).eq('thread_id', threadDbId)).count || 0,
    }).eq('id', threadDbId);
    
    return NextResponse.json({
      thread_id: threadDbId,
      user_message: userMsg,
      assistant_message: {
        id: assistantMsg?.id,
        content: answerContent,
        answer_type: answerType,
        context_truncated: contextTruncated,
        citations: answerResult?.citations || [],
      },
    });
  } catch (error) {
    const err = error as Error;
    if (err.message === 'Not authenticated') {
      return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    }
    console.error('Chat error:', err.name); // Never log message content
    return NextResponse.json({error: 'Failed to process message'}, {status: 500});
  }
}
