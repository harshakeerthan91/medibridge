'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

interface LabResult {
  id: string;
  original_label: string;
  normalised_name: string | null;
  result_text: string | null;
  result_numeric: number | null;
  unit: string | null;
  original_range: string | null;
  range_low: number | null;
  range_high: number | null;
  report_date: string | null;
  page_number: number | null;
  source_passage: string | null;
  uncertainty_reason: string | null;
  review_status: string;
}

interface PrescriptionItem {
  id: string;
  original_medicine_name: string;
  strength: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  meal_instructions: string | null;
  page_number: number | null;
  source_passage: string | null;
  missing_fields: string[] | null;
  uncertain_fields: string[] | null;
  review_status: string;
}

interface Prescription {
  id: string;
  review_status: string;
  prescription_items: PrescriptionItem[];
}

interface Explanation {
  id: string;
  what_it_says: string | null;
  what_terms_mean: string | null;
  questions_for_appointment: string | null;
  language: string;
}

interface Props {
  locale: string;
  document: Record<string, unknown>;
  previewUrl: string | null;
  labResults: LabResult[];
  prescriptions: Prescription[];
  explanation: Explanation | null;
}

type TabId = 'extracted' | 'explanation';

export default function ReviewClient({locale, document, previewUrl, labResults, prescriptions, explanation}: Props) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<TabId>('extracted');
  const [explanationData, setExplanationData] = useState<Explanation | null>(explanation);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explainError, setExplainError] = useState('');
  const [reviewedLabs, setReviewedLabs] = useState<Set<string>>(new Set());
  const [reviewedPrescItems, setReviewedPrescItems] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const docTitle = document.filename as string;
  const docStatus = document.status as string;
  const category = document.category as string;

  const allLabReviewed = labResults.length === 0 || labResults.every(l => l.review_status !== 'unreviewed' || reviewedLabs.has(l.id));
  const allPrescItems = prescriptions.flatMap(p => p.prescription_items);
  const allPrescReviewed = allPrescItems.length === 0 || allPrescItems.every(pi => pi.review_status !== 'unreviewed' || reviewedPrescItems.has(pi.id));

  async function loadExplanation() {
    setLoadingExplanation(true);
    setExplainError('');
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({document_id: document.id, locale}),
      });
      const data = await res.json();
      if (res.ok) {
        setExplanationData(data.explanation);
      } else {
        if (data.code === 'no_reviewed_data') {
          setExplainError(t('explanation.errors.noData'));
        } else if (data.code === 'config_error') {
          setExplainError(t('explanation.errors.configMissing'));
        } else {
          setExplainError(t('explanation.errors.providerUnavailable'));
        }
      }
    } catch {
      setExplainError(t('explanation.errors.providerUnavailable'));
    } finally {
      setLoadingExplanation(false);
    }
  }

  function isOutOfRange(lab: LabResult): boolean {
    if (lab.result_numeric === null || lab.range_low === null && lab.range_high === null) return false;
    if (lab.range_low !== null && lab.result_numeric < lab.range_low) return true;
    if (lab.range_high !== null && lab.result_numeric > lab.range_high) return true;
    return false;
  }

  async function markLabReviewed(labId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${document.id}/lab-results/${labId}/review`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({review_status: 'reviewed'}),
      });
      if (res.ok) {
        setReviewedLabs(prev => new Set([...prev, labId]));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{fontSize: '1.375rem', marginBottom: '4px'}}>{docTitle}</h1>
          <div className="flex gap-2 items-center">
            <span className={`badge badge-${docStatus === 'ready' ? 'success' : docStatus === 'needs_review' ? 'warning' : 'neutral'}`}>
              {t(`records.${docStatus}` as 'records.ready')}
            </span>
            <span className="badge badge-neutral">{t(`records.categories.${category}` as 'records.categories.lab_report')}</span>
          </div>
        </div>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            {t('records.preview')} ↗
          </a>
        )}
      </div>

      {/* Tabs */}
      <div style={{display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem'}}>
        {(['extracted', 'explanation'] as TabId[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2.5px solid var(--color-teal-600)' : '2.5px solid transparent',
              color: activeTab === tab ? 'var(--color-teal-700)' : 'var(--color-text-secondary)',
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.9375rem',
              marginBottom: '-1px',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {tab === 'extracted' ? t('review.title') : t('explanation.title')}
          </button>
        ))}
      </div>

      {/* Extracted data tab */}
      {activeTab === 'extracted' && (
        <div>
          {/* Disclaimer */}
          <div className="notice notice-info" style={{marginBottom: '1.5rem'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, marginTop: '2px'}}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style={{fontSize: '0.875rem'}}>{t('review.confirmNote')}</p>
          </div>

          {/* Lab results */}
          {labResults.length > 0 && (
            <div className="card" style={{marginBottom: '1.5rem'}}>
              <div className="card-header">
                <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('review.lab.title')}</h2>
                <span className="badge badge-neutral">{labResults.length} results</span>
              </div>
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem'}}>
                  <thead>
                    <tr style={{background: 'var(--color-surface-subtle)'}}>
                      <th style={{padding: '0.625rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)'}}>{t('review.lab.testName')}</th>
                      <th style={{padding: '0.625rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)'}}>{t('review.lab.result')}</th>
                      <th style={{padding: '0.625rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)'}}>{t('review.lab.unit')}</th>
                      <th style={{padding: '0.625rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)'}}>{t('review.lab.range')}</th>
                      <th style={{padding: '0.625rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)'}}>{t('review.lab.date')}</th>
                      <th style={{padding: '0.625rem 0.5rem'}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {labResults.map((lab, i) => (
                      <tr key={lab.id} style={{borderTop: '1px solid var(--color-border)', background: i % 2 === 1 ? 'var(--color-surface-raised)' : 'transparent'}}>
                        <td style={{padding: '0.625rem 1rem'}}>
                          <div>
                            <span style={{fontWeight: 500}}>{lab.original_label}</span>
                            {lab.uncertainty_reason && (
                              <p className="text-xs text-warning" style={{marginTop: '2px'}}>⚠ {lab.uncertainty_reason}</p>
                            )}
                          </div>
                        </td>
                        <td style={{padding: '0.625rem 1rem'}}>
                          <span style={{fontWeight: 600, color: isOutOfRange(lab) ? 'var(--color-error-600)' : 'inherit'}}>
                            {lab.result_text || lab.result_numeric || '—'}
                          </span>
                          {isOutOfRange(lab) && (
                            <span className="badge badge-error" style={{marginLeft: '0.5rem', fontSize: '0.7rem'}}>
                              {lab.result_numeric !== null && lab.range_low !== null && lab.result_numeric < lab.range_low ? '↓' : '↑'}
                            </span>
                          )}
                        </td>
                        <td style={{padding: '0.625rem 1rem', color: 'var(--color-text-muted)'}}>{lab.unit || '—'}</td>
                        <td style={{padding: '0.625rem 1rem', color: 'var(--color-text-muted)'}}>{lab.original_range || '—'}</td>
                        <td style={{padding: '0.625rem 1rem', color: 'var(--color-text-muted)'}}>{lab.report_date || '—'}</td>
                        <td style={{padding: '0.625rem 0.5rem'}}>
                          {lab.review_status === 'unreviewed' && !reviewedLabs.has(lab.id) ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => markLabReviewed(lab.id)}
                              disabled={saving}
                            >
                              ✓
                            </button>
                          ) : (
                            <span className="badge badge-success" style={{fontSize: '0.75rem'}}>✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isOutOfRange(labResults[0]) && (
                <div style={{padding: '0.75rem 1rem', background: 'var(--color-warning-100)', borderTop: '1px solid var(--color-border)', fontSize: '0.875rem', color: 'var(--color-warning-600)'}}>
                  ⚠ {t('explanation.outOfRange')}
                </div>
              )}
            </div>
          )}

          {/* Prescriptions */}
          {prescriptions.map(presc => (
            <div key={presc.id} className="card" style={{marginBottom: '1.5rem'}}>
              <div className="card-header">
                <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('review.prescription.title')}</h2>
              </div>
              <div style={{padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                {presc.prescription_items.map(item => (
                  <div key={item.id} style={{padding: '0.75rem', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)'}}>
                    <div className="flex justify-between items-center">
                      <p style={{fontWeight: 600}}>{item.original_medicine_name} {item.strength || ''}</p>
                      {item.review_status === 'unreviewed' && !reviewedPrescItems.has(item.id) ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setReviewedPrescItems(prev => new Set([...prev, item.id]))}
                        >
                          ✓ {t('review.confirm')}
                        </button>
                      ) : (
                        <span className="badge badge-success">Reviewed</span>
                      )}
                    </div>
                    <div className="flex gap-4 flex-wrap" style={{marginTop: '0.5rem'}}>
                      {item.dose && <span className="text-small"><span className="text-muted">{t('review.prescription.dose')}:</span> {item.dose}</span>}
                      {item.route && <span className="text-small"><span className="text-muted">{t('review.prescription.route')}:</span> {item.route}</span>}
                      {item.frequency && <span className="text-small"><span className="text-muted">{t('review.prescription.frequency')}:</span> {item.frequency}</span>}
                      {item.duration && <span className="text-small"><span className="text-muted">{t('review.prescription.duration')}:</span> {item.duration}</span>}
                      {item.meal_instructions && <span className="text-small"><span className="text-muted">{t('review.prescription.mealInstructions')}:</span> {item.meal_instructions}</span>}
                    </div>
                    {(item.missing_fields?.length || item.uncertain_fields?.length) ? (
                      <p className="text-xs text-warning" style={{marginTop: '0.5rem'}}>
                        ⚠ {t('review.unresolvedWarning')}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {labResults.length === 0 && prescriptions.length === 0 && (
            <div className="empty-state">
              <p className="empty-state-title">No extracted data</p>
              <p className="empty-state-text">Processing may still be in progress. Check back shortly or retry extraction.</p>
            </div>
          )}
        </div>
      )}

      {/* Explanation tab */}
      {activeTab === 'explanation' && (
        <div>
          <div className="notice notice-warning" style={{marginBottom: '1.5rem'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, marginTop: '2px'}}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p style={{fontSize: '0.875rem'}}>{t('explanation.disclaimer')}</p>
          </div>

          {!explanationData && !loadingExplanation && (
            <div className="empty-state">
              <p className="empty-state-title">{t('explanation.title')}</p>
              <p className="empty-state-text">
                {allLabReviewed && allPrescReviewed
                  ? 'Generate a patient-friendly explanation of this record.'
                  : t('explanation.errors.noData')}
              </p>
              <button
                className="btn btn-primary"
                onClick={loadExplanation}
                disabled={!allLabReviewed || !allPrescReviewed}
                id="generate-explanation-btn"
              >
                {t('explanation.generating').replace('…', '')} →
              </button>
              {explainError && (
                <div className="notice notice-error" style={{marginTop: '1rem', textAlign: 'left'}}>
                  {explainError}
                </div>
              )}
            </div>
          )}

          {loadingExplanation && (
            <div style={{textAlign: 'center', padding: '3rem'}}>
              <div className="spinner" style={{margin: '0 auto 1rem'}} />
              <p className="text-muted">{t('explanation.generating')}</p>
            </div>
          )}

          {explanationData && !loadingExplanation && (
            <div style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
              {explanationData.what_it_says && (
                <div className="card">
                  <div className="card-header"><h3 style={{fontSize: '1rem', fontWeight: 600}}>{t('explanation.whatItSays')}</h3></div>
                  <div className="card-body">
                    <p style={{whiteSpace: 'pre-wrap', lineHeight: 1.65}}>{explanationData.what_it_says}</p>
                  </div>
                </div>
              )}
              {explanationData.what_terms_mean && (
                <div className="card">
                  <div className="card-header"><h3 style={{fontSize: '1rem', fontWeight: 600}}>{t('explanation.whatTermsMean')}</h3></div>
                  <div className="card-body">
                    <p style={{whiteSpace: 'pre-wrap', lineHeight: 1.65}}>{explanationData.what_terms_mean}</p>
                  </div>
                </div>
              )}
              {explanationData.questions_for_appointment && (
                <div className="card">
                  <div className="card-header"><h3 style={{fontSize: '1rem', fontWeight: 600}}>{t('explanation.questionsForAppointment')}</h3></div>
                  <div className="card-body">
                    <p style={{whiteSpace: 'pre-wrap', lineHeight: 1.65}}>{explanationData.questions_for_appointment}</p>
                  </div>
                </div>
              )}
              <button
                className="btn btn-secondary"
                onClick={loadExplanation}
                style={{alignSelf: 'flex-start'}}
              >
                {t('explanation.explainMore')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="disclaimer-strip" style={{marginTop: '2rem', borderRadius: '8px'}}>
        {t('common.disclaimer')}
      </div>
    </div>
  );
}
