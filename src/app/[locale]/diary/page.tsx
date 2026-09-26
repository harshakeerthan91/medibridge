'use client';

import {useState, useEffect} from 'react';
import {useTranslations} from 'next-intl';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {SymptomEntrySchema, type SymptomEntryInput} from '@/lib/validation/schemas';

interface SymptomEntry {
  id: string;
  description: string;
  onset_date: string | null;
  severity: number | null;
  notes: string | null;
  created_at: string;
}

export default function DiaryPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState('en');
  const [entries, setEntries] = useState<SymptomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const t = useTranslations();

  useEffect(() => {
    params.then(({locale: l}) => setLocale(l));
    fetchEntries();
  }, [params]);

  const {register, handleSubmit, reset, formState: {errors}} = useForm<SymptomEntryInput>({
    resolver: zodResolver(SymptomEntrySchema),
  });

  async function fetchEntries() {
    setLoading(true);
    try {
      const res = await fetch('/api/diary');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: SymptomEntryInput) {
    setSaving(true);
    try {
      const res = await fetch('/api/diary', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
      });
      if (res.ok) {
        reset();
        setShowForm(false);
        fetchEntries();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/diary?id=${id}`, {method: 'DELETE'});
    setEntries(prev => prev.filter(e => e.id !== id));
    setDeleteConfirm(null);
  }

  function severityColor(n: number): string {
    if (n <= 3) return 'var(--color-success-600)';
    if (n <= 6) return 'var(--color-warning-600)';
    return 'var(--color-error-600)';
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('diary.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} id="add-diary-entry">
          {showForm ? t('common.cancel') : `+ ${t('diary.addEntry')}`}
        </button>
      </div>

      <div className="notice notice-info" style={{marginBottom: '1.5rem'}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, marginTop: '2px'}}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{fontSize: '0.875rem'}}>{t('diary.disclaimer')}</p>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom: '1.5rem'}}>
          <div className="card-header"><h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('diary.addEntry')}</h2></div>
          <div className="card-body">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-group">
                <label htmlFor="description" className="form-label">{t('diary.description')} *</label>
                <textarea
                  id="description"
                  className={`form-input${errors.description ? ' error' : ''}`}
                  {...register('description')}
                />
                {errors.description && <p className="form-error">{errors.description.message}</p>}
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div className="form-group">
                  <label htmlFor="onset_date" className="form-label">{t('diary.onset')}</label>
                  <input id="onset_date" type="date" className="form-input" {...register('onset_date')} />
                </div>
                <div className="form-group">
                  <label htmlFor="severity" className="form-label">{t('diary.severity')}</label>
                  <input id="severity" type="number" min={1} max={10} className="form-input" {...register('severity', {valueAsNumber: true})} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="notes" className="form-label">{t('diary.notes')}</label>
                <textarea id="notes" className="form-input" rows={2} {...register('notes')} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('common.loading') : t('diary.save')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => {setShowForm(false); reset();}}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{height: '90px', borderRadius: 'var(--radius-lg)'}} />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <p className="empty-state-title">{t('diary.empty')}</p>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
          {entries.map((entry, i) => (
            <div key={entry.id} className={`card animate-fade-in delay-${Math.min(i + 1, 4)}`}>
              <div className="card-body" style={{padding: '1rem 1.25rem'}}>
                <div className="flex justify-between items-center">
                  <div style={{flex: 1, minWidth: 0}}>
                    <p style={{fontWeight: 600, fontSize: '0.9375rem'}}>{entry.description}</p>
                    <div className="flex gap-3 flex-wrap" style={{marginTop: '4px'}}>
                      {entry.onset_date && (
                        <p className="text-small text-muted">{t('diary.onset')}: {entry.onset_date}</p>
                      )}
                      {entry.severity !== null && (
                        <p className="text-small" style={{color: severityColor(entry.severity), fontWeight: 500}}>
                          {t('diary.severityLabel', {n: entry.severity})}
                        </p>
                      )}
                      <p className="text-small text-muted">{new Date(entry.created_at).toLocaleDateString()}</p>
                    </div>
                    {entry.notes && <p className="text-small text-muted" style={{marginTop: '4px'}}>{entry.notes}</p>}
                  </div>
                  <div className="flex gap-1" style={{flexShrink: 0, marginLeft: '0.75rem'}}>
                    {deleteConfirm === entry.id ? (
                      <>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteEntry(entry.id)}>{t('common.confirm')}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(entry.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-error-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer-strip" style={{marginTop: '2rem', borderRadius: '8px'}}>
        {t('diary.disclaimer')}
      </div>
    </div>
  );
}
