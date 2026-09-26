'use client';

import {useEffect, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {UpdatePasswordSchema, type UpdatePasswordInput} from '@/lib/validation/schemas';
import {createSupabaseBrowserClient} from '@/lib/supabase/client';

export default function VerifyPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();

  const {register, handleSubmit, formState: {errors}} = useForm<UpdatePasswordInput>({
    resolver: zodResolver(UpdatePasswordSchema),
  });

  useEffect(() => {
    params.then(({locale: l}) => setLocale(l));
    const type = searchParams.get('type');
    if (type === 'recovery') setIsRecovery(true);
  }, [params, searchParams]);

  async function onSubmit(data: UpdatePasswordInput) {
    setLoading(true);
    setError('');

    try {
      const supabase = createSupabaseBrowserClient();
      const {error: updateError} = await supabase.auth.updateUser({password: data.password});
      
      if (updateError) {
        setError(t('common.error'));
        return;
      }

      router.push(`/${locale}/home`);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  if (!isRecovery) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo" style={{background: 'var(--color-success-100)'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
            </div>
            <h1 className="auth-title">{t('auth.verifyEmail')}</h1>
            <p className="auth-subtitle">{t('auth.verifyEmailMessage', {email: ''})}</p>
          </div>
          <div className="auth-card-body">
            <a href={`/${locale}/login`} className="btn btn-primary w-full" style={{textAlign: 'center', display: 'block'}}>
              {t('auth.login')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="auth-title">{t('auth.updatePassword')}</h1>
        </div>
        <div className="auth-card-body">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label htmlFor="password" className="form-label">{t('auth.newPassword')}</label>
              <input
                id="password"
                type="password"
                className={`form-input${errors.password ? ' error' : ''}`}
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
                {...register('confirm_password')}
              />
              {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
            </div>
            {error && <div className="notice notice-error" style={{marginBottom: '1rem'}}>{error}</div>}
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? t('common.loading') : t('auth.updatePassword')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
