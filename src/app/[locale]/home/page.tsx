import {getTranslations} from 'next-intl/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import Link from 'next/link';
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'My Next Steps — MediBridge',
};

export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations();
  const supabase = await createSupabaseServerClient();
  const {data: {user}} = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const userId = user.id;

  // Fetch dashboard data in parallel
  const [
    {data: reviewDocs},
    {data: recentDocs},
    {data: schedules},
    {data: followups},
    {data: questions},
  ] = await Promise.all([
    supabase
      .from('documents')
      .select('id, filename, status, category')
      .eq('owner_id', userId)
      .in('status', ['needs_review'])
      .is('deleted_at', null)
      .limit(5),
    supabase
      .from('documents')
      .select('id, filename, status, category, created_at')
      .eq('owner_id', userId)
      .in('status', ['ready', 'needs_review'])
      .is('deleted_at', null)
      .order('created_at', {ascending: false})
      .limit(5),
    supabase
      .from('medication_schedules')
      .select('id, medicine_name, dose, frequency_description, is_as_needed, confirmed_currently_taking')
      .eq('owner_id', userId)
      .eq('is_active', true)
      .eq('confirmed_currently_taking', true)
      .limit(5),
    supabase
      .from('followups')
      .select('id, instruction_text, confirmed_date, status')
      .eq('owner_id', userId)
      .eq('status', 'pending')
      .order('confirmed_date', {ascending: true, nullsFirst: false})
      .limit(3),
    supabase
      .from('saved_questions')
      .select('id, question_text')
      .eq('owner_id', userId)
      .eq('is_addressed', false)
      .limit(3),
  ]);

  const hasAnyTasks = (reviewDocs?.length ?? 0) > 0 || (schedules?.length ?? 0) > 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('home.title')}</h1>
        <Link href={`/${locale}/records`} className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('records.upload')}
        </Link>
      </div>

      {!hasAnyTasks && (
        <div className="empty-state animate-fade-in">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          </div>
          <p className="empty-state-title">{t('home.empty')}</p>
          <p className="empty-state-text">{t('home.noTasks')}</p>
          <Link href={`/${locale}/records`} className="btn btn-primary">{t('records.upload')}</Link>
        </div>
      )}

      <div style={{display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'}}>
        
        {/* Records to review */}
        {(reviewDocs?.length ?? 0) > 0 && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('home.reviewTasks')}</h2>
              <span className="badge badge-warning">{reviewDocs!.length}</span>
            </div>
            <div className="card-body" style={{padding: '0.75rem 1.25rem'}}>
              {reviewDocs!.map(doc => (
                <div key={doc.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid var(--color-border)'
                }}>
                  <div>
                    <p style={{fontWeight: 500, fontSize: '0.9375rem', marginBottom: '2px'}} className="text-truncate">
                      {doc.filename}
                    </p>
                    <span className="badge badge-warning" style={{fontSize: '0.75rem'}}>
                      {t('records.needsReview')}
                    </span>
                  </div>
                  <Link href={`/${locale}/records/${doc.id}`} className="btn btn-secondary btn-sm">
                    {t('review.confirm')}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent records */}
        {(recentDocs?.length ?? 0) > 0 && (
          <div className="card animate-fade-in delay-1">
            <div className="card-header">
              <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('home.recentRecords')}</h2>
              <Link href={`/${locale}/records`} style={{fontSize: '0.875rem', color: 'var(--color-teal-600)'}}>
                View all
              </Link>
            </div>
            <div className="card-body" style={{padding: '0.75rem 1.25rem'}}>
              {recentDocs!.slice(0, 4).map(doc => (
                <Link key={doc.id} href={`/${locale}/records/${doc.id}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0',
                  textDecoration: 'none',
                  color: 'inherit'
                }}>
                  <div className={`doc-icon doc-icon-${doc.category === 'lab_report' ? 'lab' : doc.category === 'prescription' ? 'rx' : 'pdf'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div style={{flex: 1, minWidth: 0}}>
                    <p className="text-truncate" style={{fontWeight: 500, fontSize: '0.9rem', marginBottom: '1px'}}>{doc.filename}</p>
                    <span className={`badge badge-${doc.status === 'ready' ? 'success' : 'warning'}`} style={{fontSize: '0.75rem'}}>
                      {t(`records.${doc.status}` as 'records.ready' | 'records.needsReview')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Today's schedule */}
        {(schedules?.length ?? 0) > 0 && (
          <div className="card animate-fade-in delay-2">
            <div className="card-header">
              <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('home.todaySchedule')}</h2>
              <Link href={`/${locale}/schedule`} style={{fontSize: '0.875rem', color: 'var(--color-teal-600)'}}>
                {t('nav.schedule')}
              </Link>
            </div>
            <div className="card-body" style={{padding: '0.75rem 1.25rem'}}>
              {schedules!.map(s => (
                <div key={s.id} style={{padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)'}}>
                  <p style={{fontWeight: 500, fontSize: '0.9rem'}}>{s.medicine_name}</p>
                  <p className="text-small text-muted">{s.dose} — {s.frequency_description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Follow-ups */}
        {(followups?.length ?? 0) > 0 && (
          <div className="card animate-fade-in delay-3">
            <div className="card-header">
              <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('home.upcomingFollowups')}</h2>
              <Link href={`/${locale}/visit-brief`} style={{fontSize: '0.875rem', color: 'var(--color-teal-600)'}}>
                {t('nav.visitBrief')}
              </Link>
            </div>
            <div className="card-body" style={{padding: '0.75rem 1.25rem'}}>
              {followups!.map(f => (
                <div key={f.id} style={{padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)'}}>
                  <p style={{fontWeight: 500, fontSize: '0.9rem'}} className="text-truncate">{f.instruction_text}</p>
                  {f.confirmed_date && (
                    <p className="text-small text-muted">{f.confirmed_date}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saved questions */}
        {(questions?.length ?? 0) > 0 && (
          <div className="card animate-fade-in delay-4">
            <div className="card-header">
              <h2 style={{fontSize: '1rem', fontWeight: 600}}>{t('home.savedQuestions')}</h2>
              <Link href={`/${locale}/questions`} style={{fontSize: '0.875rem', color: 'var(--color-teal-600)'}}>
                {t('nav.questions')}
              </Link>
            </div>
            <div className="card-body" style={{padding: '0.75rem 1.25rem'}}>
              {questions!.map(q => (
                <p key={q.id} style={{padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.9375rem'}}>
                  {q.question_text}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="disclaimer-strip" style={{marginTop: '2rem', borderRadius: '8px'}}>
        {t('common.disclaimer')}
      </div>
    </div>
  );
}
