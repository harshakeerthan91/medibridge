import {getTranslations} from 'next-intl/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import type {Metadata} from 'next';
import ScheduleClient from './ScheduleClient';

export const metadata: Metadata = {title: 'My Schedule — MediBridge'};

export default async function SchedulePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const supabase = await createSupabaseServerClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const {data: schedules} = await supabase
    .from('medication_schedules')
    .select('*')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .order('medicine_name');

  const today = new Date().toISOString().split('T')[0];
  const {data: logs} = await supabase
    .from('medication_logs')
    .select('*')
    .eq('owner_id', user.id)
    .eq('scheduled_date', today);

  return <ScheduleClient schedules={schedules || []} todayLogs={logs || []} locale={locale} />;
}
