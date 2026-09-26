'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {LoginSchema, type LoginInput} from '@/lib/validation/schemas';
import {createSupabaseBrowserClient} from '@/lib/supabase/client';
import Link from 'next/link';

const LANGUAGES = [
  {code: 'en', label: 'English'},
  {code: 'te', label: 'తెలుగు'},
  {code: 'hi', label: 'हिन्दी'},
] as const;

type LocaleCode = typeof LANGUAGES[number]['code'];

export default function LoginPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState<LocaleCode>('en');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const router = useRouter();
  const t = useTranslations();

  useEffect(() => {
    params.then(({locale: l}) => {
      const saved = localStorage.getItem('medibridge-locale');
      const validLocale = saved as LocaleCode;
      if (saved && LANGUAGES.find(lang => lang.code === saved)) {
        setLocale(validLocale);
      } else {
        setLocale(l as LocaleCode);
      }
    });
  }, [params]);

  const {register, handleSubmit, formState: {errors}} = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  function handleLocaleChange(code: LocaleCode) {
    setLocale(code);
    localStorage.setItem('medibridge-locale', code);
    router.push(`/${code}/login`);
  }

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    setServerError('');

    try {
      const supabase = createSupabaseBrowserClient();
      const {error} = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setServerError(t('auth.errors.loginFailed'));
        return;
      }

      // Update profile language preference
      const {data: {user}} = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({preferred_language: locale}).eq('id', user.id);
      }

      router.push(`/${locale}/home`);
      router.refresh();
    } catch {
      setServerError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <h1 className="auth-title">{t('app.name')}</h1>
          <p className="auth-subtitle" style={{marginBottom: '1.5rem'}}>{t('app.tagline')}</p>

          {/* Language picker */}
          <p style={{fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem'}}>
            Choose your language / మీ భాషను ఎంచుకోండి / अपनी भाषा चुनें
          </p>
          <div className="lang-picker">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                className={`lang-btn${locale === lang.code ? ' selected' : ''}`}
                onClick={() => handleLocaleChange(lang.code)}
                aria-pressed={locale === lang.code}
                type="button"
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <div className="auth-card-body">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label htmlFor="email" className="form-label">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                className={`form-input${errors.email ? ' error' : ''}`}
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="form-error">{errors.email.message}</p>
              )}
            </div>

            <div className="form-group">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="form-label">{t('auth.password')}</label>
                <Link href={`/${locale}/reset`} style={{fontSize: '0.8125rem', color: 'var(--color-teal-600)'}}>
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <input
                id="password"
                type="password"
                className={`form-input${errors.password ? ' error' : ''}`}
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="notice notice-error" style={{marginBottom: '1rem'}}>
                {serverError}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full btn-lg"
              disabled={loading}
              id="login-submit"
              style={{marginTop: '0.5rem'}}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="spinner" style={{width: '16px', height: '16px'}}/>
                  {t('common.loading')}
                </span>
              ) : t('auth.login')}
            </button>
          </form>

          <p style={{textAlign: 'center', marginTop: '1.25rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)'}}>
            {t('auth.noAccount')}{' '}
            <Link href={`/${locale}/signup`} style={{color: 'var(--color-teal-600)', fontWeight: 600}}>
              {t('auth.signupLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
