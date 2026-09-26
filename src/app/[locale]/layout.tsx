import {NextIntlClientProvider} from 'next-intl';
import {getMessages, getLocale} from 'next-intl/server';
import type {Metadata} from 'next';
import {routing} from '@/lib/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map(locale => ({locale}));
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'MediBridge',
    description: 'Your medical records. Clear explanations. In your language.',
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
