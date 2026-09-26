import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    const {data} = await supabase
      .from('saved_questions')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', {ascending: false})
      .limit(100);
    return NextResponse.json({questions: data || []});
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Not authenticated') return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    return NextResponse.json({error: 'Failed'}, {status: 500});
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const {question_text, source = 'manual', include_in_brief = false} = body;
    if (!question_text?.trim()) return NextResponse.json({error: 'question_text required'}, {status: 400});
    const {data, error} = await supabase.from('saved_questions').insert({
      owner_id: user.id,
      question_text: question_text.trim().slice(0, 1000),
      source,
      include_in_brief,
    }).select().single();
    if (error) return NextResponse.json({error: 'Failed to save'}, {status: 500});
    return NextResponse.json({question: data}, {status: 201});
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Not authenticated') return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    return NextResponse.json({error: 'Failed'}, {status: 500});
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    const {searchParams} = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({error: 'id required'}, {status: 400});
    await supabase.from('saved_questions').delete().eq('id', id).eq('owner_id', user.id);
    return NextResponse.json({status: 'deleted'});
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Not authenticated') return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    return NextResponse.json({error: 'Failed'}, {status: 500});
  }
}
