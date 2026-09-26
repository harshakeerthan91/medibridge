import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const {schedule_id, scheduled_date, scheduled_time, action} = body;
    
    if (!schedule_id || !scheduled_date || !action) {
      return NextResponse.json({error: 'schedule_id, scheduled_date, and action are required'}, {status: 400});
    }
    
    if (!['taken', 'skipped'].includes(action)) {
      return NextResponse.json({error: 'action must be taken or skipped'}, {status: 400});
    }
    
    // Verify schedule ownership
    const {data: schedule} = await supabase
      .from('medication_schedules')
      .select('id')
      .eq('id', schedule_id)
      .eq('owner_id', user.id)
      .single();
    
    if (!schedule) return NextResponse.json({error: 'Schedule not found'}, {status: 404});
    
    // Upsert log for this date
    const {data, error} = await supabase
      .from('medication_logs')
      .upsert({
        schedule_id,
        owner_id: user.id,
        scheduled_date,
        scheduled_time: scheduled_time || null,
        action,
      }, {onConflict: 'schedule_id,scheduled_date,scheduled_time'})
      .select()
      .single();
    
    if (error) return NextResponse.json({error: 'Failed to log'}, {status: 500});
    return NextResponse.json({log: data}, {status: 201});
  } catch (err) {
    const e = err as Error;
    if (e.message === 'Not authenticated') return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    return NextResponse.json({error: 'Failed'}, {status: 500});
  }
}
