'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {ResetPasswordSchema, type ResetPasswordInput} from '@/lib/validation/schemas';
import {createSupabaseBrowserClient} from '@/lib/supabase/client';
import Link from 'next/link';

export default function ResetPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState('en');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');
  const t = useTranslations();

  useState(() => {
    params.then(({locale: l}) => setLocale(l));
  });

  const {register, handleSubmit, formState: {errors}} = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
  });

  async function onSubmit(data: ResetPasswordInput) {
    setLoading(true);
    setServerError('');

    try {
      const supabase = createSupabaseBrowserClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      const {error} = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${appUrl}/api/auth/callback?next=/${locale}/verify?type=recovery`,
      });

      if (error) {
        setServerError(t('auth.errors.resetFailed'));
        return;
      }

      setSent(true);
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
              <path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m0 4v.01"/>
            </svg>
          </div>
          <h1 className="auth-title">{t('auth.passwordRecovery')}</h1>
        </div>

        <div className="auth-card-body">
          {sent ? (
            <div className="notice notice-success" style={{marginBottom: '1rem'}}>
              {t('auth.checkEmail')}
            </div>
          ) : (
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
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              {serverError && (
                <div className="notice notice-error" style={{marginBottom: '1rem'}}>{serverError}</div>
              )}

              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? t('common.loading') : t('auth.sendResetEmail')}
              </button>
            </form>
          )}

          <p style={{textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem'}}>
            <Link href={`/${locale}/login`} style={{color: 'var(--color-teal-600)'}}>
              {t('auth.backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
