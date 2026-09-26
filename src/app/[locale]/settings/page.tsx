'use client';

import {useState, useEffect} from 'react';
import {useTranslations} from 'next-intl';

interface SettingsData {
  full_name: string;
  preferred_language: 'en' | 'te' | 'hi';
  timezone: string;
}

const LANGUAGES = [
  {code: 'en', label: 'English'},
  {code: 'te', label: 'తెలుగు'},
  {code: 'hi', label: 'हिन्दी'},
] as const;

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Colombo',
  'UTC',
  'America/New_York',
  'Europe/London',
];

export default function SettingsPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState('en');
  const [settings, setSettings] = useState<SettingsData>({
    full_name: '',
    preferred_language: 'en',
    timezone: 'Asia/Kolkata',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState('');
  const t = useTranslations();

  useEffect(() => {
    params.then(({locale: l}) => setLocale(l));
    fetchProfile();
  }, [params]);

  async function fetchProfile() {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          full_name: data.full_name || '',
          preferred_language: data.preferred_language || 'en',
          timezone: data.timezone || 'Asia/Kolkata',
        });
        setEmail(data.email || '');
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        // If language changed, navigate to new locale
        if (settings.preferred_language !== locale) {
          window.location.href = `/${settings.preferred_language}/settings`;
        }
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><h1 className="page-title">{t('settings.title')}</h1></div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{height: '80px', borderRadius: 'var(--radius-lg)'}} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('settings.title')}</h1>
      </div>

      <div style={{maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        {/* Profile settings */}
        <div className="card">
          <div className="card-header"><h2 style={{fontSize: '1rem', fontWeight: 600}}>Profile</h2></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{t('settings.displayName')}</label>
              <input
                type="text"
                className="form-input"
                value={settings.full_name}
                onChange={e => setSettings(s => ({...s, full_name: e.target.value}))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={email} disabled style={{opacity: 0.65}} />
              <p className="form-help">Contact support to change your email address.</p>
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings.timezone')}</label>
              <select
                className="form-input"
                value={settings.timezone}
                onChange={e => setSettings(s => ({...s, timezone: e.target.value}))}
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Language settings */}
        <div className="card">
          <div className="card-header"><h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('settings.language')}</h2></div>
          <div className="card-body">
            <p className="form-help" style={{marginBottom: '0.75rem'}}>{t('settings.languageNote')}</p>
            <div className="lang-picker" style={{justifyContent: 'flex-start'}}>
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  className={`lang-btn${settings.preferred_language === lang.code ? ' selected' : ''}`}
                  onClick={() => setSettings(s => ({...s, preferred_language: lang.code}))}
                  type="button"
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="card">
          <div className="card-header"><h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('settings.privacy')}</h2></div>
          <div className="card-body">
            <p style={{fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6}}>
              {t('settings.privacyNote')}
            </p>
          </div>
        </div>

        {saved && (
          <div className="notice notice-success">{t('settings.saved')}</div>
        )}

        <button
          className="btn btn-primary btn-lg"
          onClick={saveSettings}
          disabled={saving}
          id="save-settings-btn"
        >
          {saving ? t('common.loading') : t('settings.save')}
        </button>
      </div>
    </div>
  );
}
