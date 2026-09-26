import {getTranslations} from 'next-intl/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {notFound, redirect} from 'next/navigation';
import ReviewClient from './ReviewClient';

export default async function DocumentPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  const t = await getTranslations();
  const supabase = await createSupabaseServerClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const {data: document} = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .single();

  if (!document) notFound();

  // Get signed URL for preview (5 minute)
  let previewUrl: string | null = null;
  if (document.storage_path) {
    const {data} = await supabase.storage
      .from('medical-records')
      .createSignedUrl(document.storage_path, 300);
    previewUrl = data?.signedUrl || null;
  }

  // Get lab results
  const {data: labResults} = await supabase
    .from('lab_results')
    .select('*')
    .eq('document_id', id)
    .eq('owner_id', user.id)
    .order('page_number', {ascending: true});

  // Get prescription items
  const {data: prescriptions} = await supabase
    .from('prescriptions')
    .select('*, prescription_items(*)')
    .eq('document_id', id)
    .eq('owner_id', user.id);

  // Get existing explanation if any
  const {data: explanation} = await supabase
    .from('explanations')
    .select('*')
    .eq('document_id', id)
    .eq('owner_id', user.id)
    .order('created_at', {ascending: false})
    .limit(1)
    .single();

  return (
    <ReviewClient
      locale={locale}
      document={document}
      previewUrl={previewUrl}
      labResults={labResults || []}
      prescriptions={prescriptions || []}
      explanation={explanation}
    />
  );
}
