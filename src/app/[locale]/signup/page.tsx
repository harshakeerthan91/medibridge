'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {SignupSchema, type SignupInput} from '@/lib/validation/schemas';
import {createSupabaseBrowserClient} from '@/lib/supabase/client';
import Link from 'next/link';

export default function SignupPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState('en');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showVerify, setShowVerify] = useState(false);
  const [email, setEmail] = useState('');
  const router = useRouter();
  const t = useTranslations();

  useState(() => {
    params.then(({locale: l}) => setLocale(l));
  });

  const {register, handleSubmit, formState: {errors}} = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
  });

  async function onSubmit(data: SignupInput) {
    setLoading(true);
    setServerError('');

    try {
      const supabase = createSupabaseBrowserClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      const {error} = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {full_name: data.full_name || ''},
          emailRedirectTo: `${appUrl}/api/auth/callback?next=/${locale}/home`,
        },
      });

      if (error) {
        console.error("Signup error:", error);
        let errorMsg = t('auth.errors.signupFailed');
        if (error.message.toLowerCase().includes('database error')) {
          errorMsg = 'Server database configuration error (Trigger failed). Please run migration 004 in your Supabase SQL editor.';
        } else if (error.message.toLowerCase().includes('already registered')) {
          errorMsg = 'An account with this email address already exists.';
        } else if (error.message.toLowerCase().includes('rate limit')) {
          errorMsg = 'Too many requests. Please try again later.';
        } else if (error.message) {
          errorMsg = error.message; // Fallback to safe Supabase message
        }
        setServerError(errorMsg);
        return;
      }

      setEmail(data.email);
      setShowVerify(true);
    } catch {
      setServerError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  if (showVerify) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo" style={{background: 'var(--color-success-100)'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <h1 className="auth-title">{t('auth.signup')}</h1>
          <p className="auth-subtitle">{t('app.tagline')}</p>
        </div>

        <div className="auth-card-body">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
                {...register('email')}
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">{t('auth.password')}</label>
              <input
                id="password"
                type="password"
                className={`form-input${errors.password ? ' error' : ''}`}
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password" className="form-label">{t('auth.confirmPassword')}</label>
              <input
                id="confirm_password"
                type="password"
                className={`form-input${errors.confirm_password ? ' error' : ''}`}
                autoComplete="new-password"
                {...register('confirm_password')}
              />
              {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
            </div>

            {serverError && (
              <div className="notice notice-error" style={{marginBottom: '1rem'}}>{serverError}</div>
            )}

            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} id="signup-submit">
              {loading ? <span className="flex items-center gap-2"><span className="spinner" style={{width: '16px', height: '16px'}}/>{t('common.loading')}</span> : t('auth.signup')}
            </button>
          </form>

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
