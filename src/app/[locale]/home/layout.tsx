import {redirect} from 'next/navigation';
import {getSession} from '@/lib/supabase/server';
import AppLayout from '@/components/layout/AppLayout';

export default async function AuthenticatedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  return (
    <AppLayout locale={locale}>
      {children}
    </AppLayout>
  );
}
