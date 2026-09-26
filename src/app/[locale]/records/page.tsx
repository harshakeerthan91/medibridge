'use client';

import {useState, useCallback, useRef, useEffect} from 'react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import crypto from 'crypto';

interface Document {
  id: string;
  filename: string;
  status: string;
  category: string;
  report_date: string | null;
  created_at: string;
  mime_type: string;
  size_bytes: number;
  patient_name_mismatch: boolean;
}

const CATEGORIES = ['all', 'lab_report', 'prescription', 'discharge_summary', 'other'] as const;
type CategoryFilter = typeof CATEGORIES[number];

function StatusBadge({status, t}: {status: string; t: (k: string) => string}) {
  const map: Record<string, string> = {
    ready: 'badge-success',
    needs_review: 'badge-warning',
    processing: 'badge-info',
    failed: 'badge-error',
    uploaded: 'badge-neutral',
    unclassified: 'badge-neutral',
  };
  const labelMap: Record<string, string> = {
    ready: t('records.ready'),
    needs_review: t('records.needsReview'),
    processing: t('records.processing'),
    failed: t('records.failed'),
    uploaded: t('records.uploading'),
  };
  return (
    <span className={`badge ${map[status] || 'badge-neutral'}`}>
      {labelMap[status] || status}
    </span>
  );
}

export default function RecordsPage({params}: {params: Promise<{locale: string}>}) {
  const [locale, setLocale] = useState('en');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations();

  useEffect(() => {
    params.then(({locale: l}) => setLocale(l));
  }, [params]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedCategory === 'all'
        ? '/api/documents'
        : `/api/documents?category=${selectedCategory}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleFile(file: File) {
    setError('');
    
    // Client-side validation
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('records.errors.wrongType'));
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError(t('records.errors.fileTooLarge'));
      return;
    }

    setUploading(true);
    setUploadProgress(t('records.uploading'));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('idempotency_key', `upload-${Date.now()}-${Math.random()}`);

      const uploadRes = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        if (uploadData.code === 'duplicate') {
          setError(t('records.errors.duplicate'));
        } else if (uploadData.code === 'file_too_large') {
          setError(t('records.errors.fileTooLarge'));
        } else if (uploadData.code === 'wrong_type') {
          setError(t('records.errors.wrongType'));
        } else {
          setError(t('records.errors.uploadFailed'));
        }
        return;
      }

      setUploadProgress(t('records.processing'));

      // Trigger extraction
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          document_id: uploadData.document_id,
          idempotency_key: `extract-${uploadData.document_id}`,
        }),
      });

      if (!extractRes.ok) {
        const extractData = await extractRes.json();
        if (extractData.code === 'config_error') {
          setError(t('common.configError'));
        } else {
          setError(`Processing note: ${extractData.error || 'Please retry.'}`);
        }
      }

      await fetchDocuments();
    } catch {
      setError(t('records.errors.uploadFailed'));
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleDelete(docId: string) {
    const res = await fetch(`/api/documents?id=${docId}`, {method: 'DELETE'});
    if (res.ok) {
      setDocuments(prev => prev.filter(d => d.id !== docId));
    }
    setDeleteConfirm(null);
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  const filtered = selectedCategory === 'all'
    ? documents
    : documents.filter(d => d.category === selectedCategory);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('records.title')}</h1>
      </div>

      {/* Upload area */}
      <div
        className={`dropzone${dragOver ? ' drag-over' : ''}`}
        style={{marginBottom: '2rem'}}
        onDragOver={e => {e.preventDefault(); setDragOver(true);}}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={t('records.upload')}
        id="upload-dropzone"
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="sr-only"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          disabled={uploading}
        />
        {uploading ? (
          <div>
            <div className="spinner" style={{margin: '0 auto 1rem'}} />
            <p style={{color: 'var(--color-teal-600)', fontWeight: 500}}>{uploadProgress}</p>
          </div>
        ) : (
          <>
            <div className="upload-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p style={{fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.25rem'}}>
              {t('records.dragDrop')}
            </p>
            <p className="text-small text-muted">{t('records.supported')}</p>
          </>
        )}
      </div>

      {error && (
        <div className="notice notice-error" style={{marginBottom: '1.5rem'}}>
          {error}
          <button className="btn btn-ghost btn-sm" onClick={() => setError('')} style={{marginLeft: 'auto'}}>×</button>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap" style={{marginBottom: '1.5rem'}}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {t(`records.categories.${cat}` as 'records.categories.all')}
          </button>
        ))}
      </div>

      {/* Document list */}
      {loading ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{height: '80px', borderRadius: 'var(--radius-lg)'}} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p className="empty-state-title">
            {selectedCategory === 'all' ? t('records.empty') : t('records.emptyCategory')}
          </p>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
          {filtered.map((doc, i) => (
            <div key={doc.id} className={`doc-card animate-fade-in delay-${Math.min(i + 1, 4)}`}>
              <div className={`doc-icon ${doc.category === 'lab_report' ? 'doc-icon-lab' : doc.category === 'prescription' ? 'doc-icon-rx' : 'doc-icon-pdf'}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-truncate" style={{fontWeight: 600, fontSize: '0.9375rem', flex: 1, minWidth: 0}}>
                    {doc.filename}
                  </p>
                  <StatusBadge status={doc.status} t={t} />
                  {doc.patient_name_mismatch && (
                    <span className="badge badge-warning" style={{fontSize: '0.75rem'}}>⚠ Name mismatch</span>
                  )}
                </div>
                <p className="text-small text-muted" style={{marginTop: '2px'}}>
                  {formatSize(doc.size_bytes)} · {t('common.uploadedOn', {date: new Date(doc.created_at).toLocaleDateString()})}
                  {doc.report_date && ` · Report: ${doc.report_date}`}
                </p>
              </div>
              <div className="flex gap-2" style={{flexShrink: 0}}>
                {doc.status === 'needs_review' && (
                  <Link href={`/${locale}/records/${doc.id}`} className="btn btn-secondary btn-sm">
                    {t('records.review')}
                  </Link>
                )}
                {doc.status === 'ready' && (
                  <Link href={`/${locale}/records/${doc.id}`} className="btn btn-secondary btn-sm">
                    {t('records.preview')}
                  </Link>
                )}
                {deleteConfirm === doc.id ? (
                  <div className="flex gap-1">
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)}>
                      {t('common.confirm')}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(doc.id)} aria-label={t('records.delete')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-error-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer-strip" style={{marginTop: '2rem', borderRadius: '8px'}}>
        {t('common.disclaimer')}
      </div>
    </div>
  );
}
