import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  {params}: {params: Promise<{id: string; resultId: string}>},
) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    const {id: documentId, resultId} = await params;
    const body = await request.json();
    const {review_status = 'reviewed'} = body;
    
    if (!['reviewed', 'corrected', 'uncertain'].includes(review_status)) {
      return NextResponse.json({error: 'Invalid review_status'}, {status: 400});
    }
    
    // Verify document and result ownership (double-check via both foreign keys)
    const {data: lab} = await supabase
      .from('lab_results')
      .select('id')
      .eq('id', resultId)
      .eq('document_id', documentId)
      .eq('owner_id', user.id)
      .single();
    
    if (!lab) return NextResponse.json({error: 'Lab result not found'}, {status: 404});
    
    const {data, error} = await supabase
      .from('lab_results')
      .update({
        review_status,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', resultId)
      .eq('owner_id', user.id)
      .select()
      .single();
    
    if (error) return NextResponse.json({error: 'Failed to update'}, {status: 500});
    return NextResponse.json({lab_result: data});
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Not authenticated') return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    return NextResponse.json({error: 'Failed'}, {status: 500});
  }
}
