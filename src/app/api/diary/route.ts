import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    const {data} = await supabase
      .from('symptom_entries')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', {ascending: false})
      .limit(50);
    return NextResponse.json({entries: data || []});
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
    const {description, onset_date, severity, notes} = body;
    if (!description?.trim()) return NextResponse.json({error: 'description required'}, {status: 400});
    if (severity !== undefined && severity !== null && (severity < 1 || severity > 10)) {
      return NextResponse.json({error: 'severity must be 1-10'}, {status: 400});
    }
    const {data, error} = await supabase.from('symptom_entries').insert({
      owner_id: user.id,
      description: description.trim().slice(0, 1000),
      onset_date: onset_date || null,
      severity: severity || null,
      notes: notes?.trim().slice(0, 2000) || null,
    }).select().single();
    if (error) return NextResponse.json({error: 'Failed to save'}, {status: 500});
    return NextResponse.json({entry: data}, {status: 201});
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
    await supabase.from('symptom_entries').delete().eq('id', id).eq('owner_id', user.id);
    return NextResponse.json({status: 'deleted'});
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Not authenticated') return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    return NextResponse.json({error: 'Failed'}, {status: 500});
  }
}
