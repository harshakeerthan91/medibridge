import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    
    const [{data: profile}, {data: authUser}] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.auth.getUser(),
    ]);
    
    return NextResponse.json({
      ...(profile || {}),
      email: authUser.user?.email,
    });
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Not authenticated') return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    return NextResponse.json({error: 'Failed'}, {status: 500});
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const {full_name, preferred_language, timezone} = body;
    
    const update: Record<string, unknown> = {};
    if (full_name !== undefined) update.full_name = full_name?.trim().slice(0, 200) || null;
    if (preferred_language && ['en', 'te', 'hi'].includes(preferred_language)) {
      update.preferred_language = preferred_language;
    }
    if (timezone) update.timezone = timezone.slice(0, 100);
    
    const {data, error} = await supabase
      .from('profiles')
      .update(update)
      .eq('id', user.id)
      .select()
      .single();
    
    if (error) return NextResponse.json({error: 'Failed to update'}, {status: 500});
    return NextResponse.json({profile: data});
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Not authenticated') return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    return NextResponse.json({error: 'Failed'}, {status: 500});
  }
}
