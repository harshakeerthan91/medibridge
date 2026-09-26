'use client';

import {useState, useEffect} from 'react';
import {useTranslations} from 'next-intl';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {SavedQuestionSchema, type SavedQuestionInput} from '@/lib/validation/schemas';

interface Question {
  id: string;
  question_text: string;
  source: string | null;
  is_addressed: boolean;
  include_in_brief: boolean;
  created_at: string;
}

export default function QuestionsPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState('en');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const t = useTranslations();

  useEffect(() => {
    params.then(({locale: l}) => setLocale(l));
    fetchQuestions();
  }, [params]);

  const {register, handleSubmit, reset, formState: {errors}} = useForm<any>({
    resolver: zodResolver(SavedQuestionSchema) as any,
  });

  async function fetchQuestions() {
    setLoading(true);
    try {
      const res = await fetch('/api/questions');
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: SavedQuestionInput) {
    setSaving(true);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
      });
      if (res.ok) {
        reset();
        setShowForm(false);
        fetchQuestions();
      }
    } finally {
      setSaving(false);
    }
  }

  async function markAddressed(id: string) {
    await fetch(`/api/questions/${id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({is_addressed: true}),
    });
    setQuestions(prev => prev.map(q => q.id === id ? {...q, is_addressed: true} : q));
  }

  async function toggleBrief(id: string, include: boolean) {
    await fetch(`/api/questions/${id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({include_in_brief: include}),
    });
    setQuestions(prev => prev.map(q => q.id === id ? {...q, include_in_brief: include} : q));
  }

  async function deleteQuestion(id: string) {
    await fetch(`/api/questions?id=${id}`, {method: 'DELETE'});
    setQuestions(prev => prev.filter(q => q.id !== id));
    setDeleteConfirm(null);
  }

  const active = questions.filter(q => !q.is_addressed);
  const addressed = questions.filter(q => q.is_addressed);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('questions.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} id="add-question-btn">
          {showForm ? t('common.cancel') : `+ ${t('questions.add')}`}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom: '1.5rem'}}>
          <div className="card-header"><h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('questions.add')}</h2></div>
          <div className="card-body">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-group">
                <label htmlFor="question_text" className="form-label">{t('questions.questionText')} *</label>
                <textarea
                  id="question_text"
                  className={`form-input${errors.question_text ? ' error' : ''}`}
                  {...register('question_text')}
                  rows={2}
                />
                {errors.question_text && <p className="form-error">{errors.question_text.message as string}</p>}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('common.loading') : t('common.save')}
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
          {[1,2].map(i => <div key={i} className="skeleton" style={{height: '80px', borderRadius: 'var(--radius-lg)'}} />)}
        </div>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">{t('questions.empty')}</p>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          {active.length > 0 && (
            <div>
              <h2 style={{fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-text-secondary)'}}>
                Pending ({active.length})
              </h2>
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                {active.map(q => (
                  <div key={q.id} className="card">
                    <div className="card-body" style={{padding: '1rem 1.25rem'}}>
                      <div className="flex justify-between items-start gap-2">
                        <p style={{fontWeight: 500, flex: 1}}>{q.question_text}</p>
                        <div className="flex gap-1" style={{flexShrink: 0}}>
                          <button
                            className={`btn btn-sm ${q.include_in_brief ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => toggleBrief(q.id, !q.include_in_brief)}
                            title={t('questions.includeInBrief')}
                          >
                            📋
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => markAddressed(q.id)}
                          >
                            ✓ {t('questions.markAddressed')}
                          </button>
                          {deleteConfirm === q.id ? (
                            <>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteQuestion(q.id)}>{t('common.confirm')}</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</button>
                            </>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(q.id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-error-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      {q.include_in_brief && (
                        <span className="badge badge-info" style={{fontSize: '0.75rem', marginTop: '0.5rem'}}>
                          📋 {t('questions.includeInBrief')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {addressed.length > 0 && (
            <div>
              <h2 style={{fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-text-muted)'}}>
                Addressed ({addressed.length})
              </h2>
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                {addressed.map(q => (
                  <div key={q.id} className="card" style={{opacity: 0.6}}>
                    <div className="card-body" style={{padding: '0.75rem 1.25rem'}}>
                      <div className="flex justify-between items-center gap-2">
                        <p style={{flex: 1, textDecoration: 'line-through'}}>{q.question_text}</p>
                        <span className="badge badge-success">✓</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
