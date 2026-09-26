import {getRequestConfig} from 'next-intl/server';
import {routing} from '@/lib/i18n/routing';

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;
  
  // Validate locale
  if (!locale || !routing.locales.includes(locale as 'en' | 'te' | 'hi')) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default[locale],
  };
});
