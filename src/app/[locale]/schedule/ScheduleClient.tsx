'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

interface Schedule {
  id: string;
  medicine_name: string;
  dose: string;
  frequency_description: string;
  times_of_day: string[] | null;
  is_as_needed: boolean;
  is_active: boolean;
  confirmed_currently_taking: boolean;
}

interface Log {
  id: string;
  schedule_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  action: 'taken' | 'skipped';
}

interface Props {
  schedules: Schedule[];
  todayLogs: Log[];
  locale: string;
}

export default function ScheduleClient({schedules, todayLogs, locale}: Props) {
  const t = useTranslations();
  const [logs, setLogs] = useState<Log[]>(todayLogs);
  const [logging, setLogging] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  function getLog(scheduleId: string) {
    return logs.find(l => l.schedule_id === scheduleId);
  }

  async function logAction(scheduleId: string, action: 'taken' | 'skipped') {
    setLogging(scheduleId);
    try {
      const res = await fetch('/api/medication-log', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          schedule_id: scheduleId,
          scheduled_date: today,
          action,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(prev => {
          const filtered = prev.filter(l => l.schedule_id !== scheduleId);
          return [...filtered, data.log];
        });
      }
    } finally {
      setLogging(null);
    }
  }

  const current = schedules.filter(s => s.confirmed_currently_taking);
  const notCurrent = schedules.filter(s => !s.confirmed_currently_taking);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('schedule.title')}</h1>
        <div style={{textAlign: 'right'}}>
          <p className="text-small text-muted">{t('schedule.today')}</p>
          <p style={{fontWeight: 600}}>{new Date().toLocaleDateString(locale === 'en' ? 'en-IN' : locale === 'hi' ? 'hi-IN' : 'te-IN', {weekday: 'long', month: 'long', day: 'numeric'})}</p>
        </div>
      </div>

      <div className="notice notice-info" style={{marginBottom: '1.5rem'}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, marginTop: '2px'}}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{fontSize: '0.875rem'}}>{t('schedule.disclaimer')}</p>
      </div>

      {schedules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p className="empty-state-title">{t('schedule.noMedicines')}</p>
        </div>
      ) : (
        <>
          {current.length > 0 && (
            <div className="card" style={{marginBottom: '1.5rem'}}>
              <div className="card-header">
                <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('schedule.currentlyTaking')}</h2>
              </div>
              <div style={{padding: '0.5rem 1.25rem'}}>
                {current.map(sched => {
                  const log = getLog(sched.id);
                  return (
                    <div key={sched.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.875rem 0',
                      borderBottom: '1px solid var(--color-border)',
                      gap: '1rem',
                    }}>
                      <div style={{flex: 1, minWidth: 0}}>
                        <p style={{fontWeight: 600, fontSize: '0.9375rem'}}>{sched.medicine_name}</p>
                        <p className="text-small text-muted">{sched.dose} — {sched.frequency_description}</p>
                        {sched.is_as_needed && (
                          <span className="badge badge-neutral" style={{fontSize: '0.75rem', marginTop: '4px'}}>{t('schedule.asNeeded')}</span>
                        )}
                      </div>
                      <div className="flex gap-2" style={{flexShrink: 0}}>
                        {log ? (
                          <span className={`badge badge-${log.action === 'taken' ? 'success' : 'warning'}`}>
                            {t(`schedule.${log.action}`)}
                          </span>
                        ) : (
                          <>
                            <button
                              className="btn btn-sm"
                              style={{background: 'var(--color-success-100)', color: 'var(--color-success-600)', border: '1px solid hsla(142, 52%, 32%, 0.2)'}}
                              onClick={() => logAction(sched.id, 'taken')}
                              disabled={logging === sched.id}
                            >
                              ✓ {t('schedule.taken')}
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => logAction(sched.id, 'skipped')}
                              disabled={logging === sched.id}
                            >
                              {t('schedule.skipped')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {notCurrent.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('schedule.notCurrentlyTaking')}</h2>
              </div>
              <div style={{padding: '0.5rem 1.25rem'}}>
                {notCurrent.map(sched => (
                  <div key={sched.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 0',
                    borderBottom: '1px solid var(--color-border)',
                    gap: '1rem',
                    opacity: 0.65,
                  }}>
                    <div>
                      <p style={{fontWeight: 600, fontSize: '0.9375rem'}}>{sched.medicine_name}</p>
                      <p className="text-small text-muted">{sched.dose} — {sched.frequency_description}</p>
                    </div>
                    <span className="badge badge-neutral" style={{fontSize: '0.8rem'}}>
                      {t('schedule.notCurrentlyTaking')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="disclaimer-strip" style={{marginTop: '2rem', borderRadius: '8px'}}>
        {t('schedule.noRecommendation')}
      </div>
    </div>
  );
}
