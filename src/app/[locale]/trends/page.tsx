import {getTranslations} from 'next-intl/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import TrendsClient from './TrendsClient';
import type {Metadata} from 'next';

export const metadata: Metadata = {title: 'Trends — MediBridge'};

export default async function TrendsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const supabase = await createSupabaseServerClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Get all reviewed lab results with their dates
  const {data: labResults} = await supabase
    .from('lab_results')
    .select('id, original_label, normalised_name, result_numeric, result_text, unit, original_range, range_low, range_high, report_date, document_id')
    .eq('owner_id', user.id)
    .in('review_status', ['reviewed', 'corrected'])
    .not('report_date', 'is', null)
    .order('report_date', {ascending: true});

  // Group by normalised_name + unit (compatibility groups)
  const groups: Record<string, typeof labResults> = {};
  for (const lab of (labResults || [])) {
    if (!lab.result_numeric) continue;
    const key = `${lab.normalised_name || lab.original_label}|${lab.unit || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(lab);
  }

  // Only show groups with ≥ 2 results
  const trendGroups = Object.entries(groups)
    .filter(([, results]) => results!.length >= 2)
    .map(([key, results]) => ({
      key,
      label: key.split('|')[0] || key,
      unit: key.split('|')[1] || '',
      results: results!,
    }));

  return <TrendsClient trendGroups={trendGroups} locale={locale} />;
}
