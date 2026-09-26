import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  {params}: {params: Promise<{id: string}>},
) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    const {id} = await params;
    const body = await request.json();
    const {is_addressed, include_in_brief} = body;
    
    const update: Record<string, unknown> = {};
    if (typeof is_addressed === 'boolean') {
      update.is_addressed = is_addressed;
      if (is_addressed) update.addressed_at = new Date().toISOString();
    }
    if (typeof include_in_brief === 'boolean') {
      update.include_in_brief = include_in_brief;
    }
    
    const {data, error} = await supabase
      .from('saved_questions')
      .update(update)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();
    
    if (error) return NextResponse.json({error: 'Failed to update'}, {status: 500});
    return NextResponse.json({question: data});
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Not authenticated') return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    return NextResponse.json({error: 'Failed'}, {status: 500});
  }
}
