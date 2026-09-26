'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

interface LabResult {
  id: string;
  original_label: string;
  result_text: string | null;
  result_numeric: number | null;
  unit: string | null;
  report_date: string | null;
}

interface PrescriptionItem {
  id: string;
  original_medicine_name: string;
  dose: string | null;
  frequency: string | null;
  confirmed_currently_taking: boolean;
}

interface SymptomEntry {
  id: string;
  description: string;
  onset_date: string | null;
  severity: number | null;
  created_at: string;
}

interface SavedQuestion {
  id: string;
  question_text: string;
  include_in_brief: boolean;
}

interface Brief {
  id: string;
  title: string;
  reason_for_visit: string | null;
  recorded_results: string | null;
  compatible_changes: string | null;
  confirmed_medicines: string | null;
  reported_symptoms: string | null;
  unresolved_issues: string | null;
  questions: string | null;
  created_at: string;
}

interface Props {
  locale: string;
  labResults: LabResult[];
  prescriptionItems: PrescriptionItem[];
  symptoms: SymptomEntry[];
  questions: SavedQuestion[];
  briefs: Brief[];
}

export default function VisitBriefPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState('en');
  const [generating, setGenerating] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState('');
  const t = useTranslations();

  useState(() => {
    params.then(({locale: l}) => setLocale(l));
  });

  async function generateBrief() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/visit-brief', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({locale}),
      });
      const data = await res.json();
      if (res.ok) {
        setBrief(data.brief);
      } else {
        setError(data.error || t('common.error'));
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('visitBrief.title')}</h1>
        <div className="flex gap-2">
          {brief && (
            <button className="btn btn-secondary" onClick={() => window.print()}>
              🖨 {t('visitBrief.print')}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={generateBrief}
            disabled={generating}
            id="generate-brief-btn"
          >
            {generating ? t('visitBrief.generating') : t('visitBrief.generate')}
          </button>
        </div>
      </div>

      <div className="notice notice-warning" style={{marginBottom: '1.5rem'}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, marginTop: '2px'}}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p style={{fontSize: '0.875rem'}}>{t('visitBrief.disclaimer')}</p>
      </div>

      {error && (
        <div className="notice notice-error" style={{marginBottom: '1.5rem'}}>{error}</div>
      )}

      {!brief && !generating && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
          </div>
          <p className="empty-state-title">{t('visitBrief.empty')}</p>
          <button className="btn btn-primary" onClick={generateBrief} id="generate-brief-start-btn">
            {t('visitBrief.generate')}
          </button>
        </div>
      )}

      {generating && (
        <div style={{textAlign: 'center', padding: '3rem'}}>
          <div className="spinner" style={{margin: '0 auto 1rem'}} />
          <p className="text-muted">{t('visitBrief.generating')}</p>
        </div>
      )}

      {brief && !generating && (
        <div className="visit-brief-print-header" style={{display: 'none'}}>
          <h1 style={{fontSize: '1.25rem'}}>{t('visitBrief.patientLabel')}</h1>
          <p>{new Date().toLocaleDateString()}</p>
        </div>
      )}

      {brief && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
          {[
            {key: 'reason_for_visit', field: brief.reason_for_visit},
            {key: 'recorded_results', field: brief.recorded_results},
            {key: 'compatible_changes', field: brief.compatible_changes},
            {key: 'confirmed_medicines', field: brief.confirmed_medicines},
            {key: 'reported_symptoms', field: brief.reported_symptoms},
            {key: 'unresolved_issues', field: brief.unresolved_issues},
            {key: 'questions', field: brief.questions},
          ].map(({key, field}) => field ? (
            <div key={key} className="card">
              <div className="card-header">
                <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t(`visitBrief.${key}` as 'visitBrief.reason_for_visit')}</h2>
              </div>
              <div className="card-body">
                <p style={{whiteSpace: 'pre-wrap', lineHeight: 1.65}}>{field}</p>
              </div>
            </div>
          ) : null)}

          <div className="disclaimer-strip" style={{borderRadius: '8px'}}>
            <strong>{t('visitBrief.patientLabel')}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
