'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod'
import {SignupSchema, type SignupInput} from '@/lib/validation/schemas';
import {createSupabaseBrowserClient} from '@/lib/supabase/client';
import Link from 'next/link';

const LANGUAGES = [
  {code: 'en', label: 'English'},
  {code: 'te', label: 'తెలుగు'},
  {code: 'hi', label: 'हिन्दी'},
] as const;

type LocaleCode = typeof LANGUAGES[number]['code'];

export default function SignupPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState<LocaleCode>('en');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [email, setEmail] = useState('');
  const router = useRouter();
  const t = useTranslations();

  // Fix: use useEffect, not useState, to resolve async params
  useEffect(() => {
    params.then(({locale: l}) => {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('medibridge-locale') : null;
      if (saved && LANGUAGES.find(lang => lang.code === saved)) {
        setLocale(saved as LocaleCode);
      } else {
        setLocale(l as LocaleCode);
      }
    });
  }, [params]);

  const {register, handleSubmit, formState: {errors}} = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
  });

  function handleLocaleChange(code: LocaleCode) {
    setLocale(code);
    if (typeof window !== 'undefined') localStorage.setItem('medibridge-locale', code);
    router.push(`/${code}/signup`);
  }

  async function onSubmit(data: SignupInput) {
    setLoading(true);
    setServerError('');

    try {
      const supabase = createSupabaseBrowserClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

      const {data: signupData, error} = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name?.trim() || '',
            preferred_language: locale,
          },
          emailRedirectTo: `${appUrl}/api/auth/callback?next=/${locale}/home`,
        },
      });

      if (error) {
        console.error('Signup error:', error.message);
        let errorMsg = t('auth.errors.signupFailed');
        if (error.message.toLowerCase().includes('database error') ||
            error.message.toLowerCase().includes('unexpected_failure')) {
          errorMsg = 'A database configuration error occurred. Please ensure migration 004 has been applied in your Supabase SQL editor.';
        } else if (error.message.toLowerCase().includes('already registered') ||
                   error.message.toLowerCase().includes('user already registered')) {
          errorMsg = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.toLowerCase().includes('rate limit') ||
                   error.message.toLowerCase().includes('email rate limit')) {
          errorMsg = 'Too many requests. Please wait a moment and try again.';
        } else if (error.message.toLowerCase().includes('password')) {
          errorMsg = error.message;
        } else if (error.message) {
          errorMsg = error.message;
        }
        setServerError(errorMsg);
        return;
      }

      // If session is present, email confirmation is disabled — go straight to app
      if (signupData?.session) {
        router.push(`/${locale}/home`);
        router.refresh();
        return;
      }

      // Session is null = confirmation email sent (Supabase default)
      setEmail(data.email);
      setShowVerify(true);
    } catch (err) {
      console.error('Unexpected signup error:', err);
      setServerError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setServerError('');
    try {
      const supabase = createSupabaseBrowserClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

      if (typeof window !== 'undefined') localStorage.setItem('medibridge-locale', locale);

      const {error} = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${appUrl}/api/auth/callback?next=/${locale}/home`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes('provider is not enabled') ||
            error.message.toLowerCase().includes('unsupported provider')) {
          setServerError('Google sign-in is not yet configured. Please use email and password, or contact support.');
        } else {
          setServerError(error.message || t('common.error'));
        }
        setGoogleLoading(false);
      }
    } catch {
      setServerError(t('common.error'));
      setGoogleLoading(false);
    }
  }

  if (showVerify) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo" style={{background: 'var(--color-success-100)'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <h1 className="auth-title">{t('auth.verifyEmail')}</h1>
            <p className="auth-subtitle">
              {t('auth.verifyEmailMessage', {email})}
            </p>
          </div>
          <div className="auth-card-body">
            <Link href={`/${locale}/login`} className="btn btn-secondary w-full" style={{textAlign: 'center', display: 'block'}}>
              {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <h1 className="auth-title">{t('auth.signup')}</h1>
          <p className="auth-subtitle" style={{marginBottom: '1.25rem'}}>{t('app.tagline')}</p>

          {/* Language picker on signup too */}
          <div className="lang-picker" role="group" aria-label="Select language">
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
          <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Create account form">
            <div className="form-group">
              <label htmlFor="full_name" className="form-label">{t('auth.fullName')}</label>
              <input
                id="full_name"
                type="text"
                className="form-input"
                autoComplete="name"
                {...register('full_name')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                className={`form-input${errors.email ? ' error' : ''}`}
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="form-error" role="alert">{errors.email.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">{t('auth.password')}</label>
              <div style={{position: 'relative'}}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input${errors.password ? ' error' : ''}`}
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  style={{paddingRight: '44px'}}
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)',
                    padding: '4px', display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="form-error" role="alert">{errors.password.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password" className="form-label">{t('auth.confirmPassword')}</label>
              <div style={{position: 'relative'}}>
                <input
                  id="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`form-input${errors.confirm_password ? ' error' : ''}`}
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirm_password}
                  style={{paddingRight: '44px'}}
                  {...register('confirm_password')}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirmPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)',
                    padding: '4px', display: 'flex', alignItems: 'center',
                  }}
                >
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirm_password && <p className="form-error" role="alert">{errors.confirm_password.message}</p>}
            </div>

            {serverError && (
              <div className="notice notice-error" style={{marginBottom: '1rem'}} role="alert">{serverError}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full btn-lg"
              disabled={loading || googleLoading}
              id="signup-submit"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="spinner" style={{width: '16px', height: '16px'}} aria-hidden="true"/>
                  {t('common.loading')}
                </span>
              ) : t('auth.signup')}
            </button>
          </form>

          {/* Divider */}
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', margin: '1.25rem 0'}}>
            <div style={{flex: 1, height: '1px', background: 'var(--color-border)'}}/>
            <span style={{fontSize: '0.8125rem', color: 'var(--color-text-muted)', flexShrink: 0}}>or</span>
            <div style={{flex: 1, height: '1px', background: 'var(--color-border)'}}/>
          </div>

          {/* Google Sign-up */}
          <button
            type="button"
            id="google-signup"
            className="btn btn-secondary w-full"
            disabled={loading || googleLoading}
            onClick={handleGoogleSignIn}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              border: '1.5px solid var(--color-border)', background: 'white',
              color: 'var(--color-text-primary)', fontWeight: 500, fontSize: '0.9375rem',
              padding: '11px 20px',
            }}
          >
            {googleLoading ? (
              <span className="flex items-center gap-2">
                <span className="spinner" style={{width: '16px', height: '16px'}} aria-hidden="true"/>
                {t('common.loading')}
              </span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <p style={{textAlign: 'center', marginTop: '1.25rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)'}}>
            {t('auth.hasAccount')}{' '}
            <Link href={`/${locale}/login`} style={{color: 'var(--color-teal-600)', fontWeight: 600}}>
              {t('auth.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
