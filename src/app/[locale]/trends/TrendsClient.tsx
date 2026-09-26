'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend} from 'recharts';

interface LabResult {
  id: string;
  original_label: string;
  normalised_name: string | null;
  result_numeric: number;
  result_text: string | null;
  unit: string;
  original_range: string | null;
  range_low: number | null;
  range_high: number | null;
  report_date: string;
  document_id: string;
}

interface TrendGroup {
  key: string;
  label: string;
  unit: string;
  results: LabResult[];
}

interface Props {
  trendGroups: TrendGroup[];
  locale: string;
}

export default function TrendsClient({trendGroups, locale}: Props) {
  const t = useTranslations();
  const [selected, setSelected] = useState<string | null>(trendGroups[0]?.key || null);

  const selectedGroup = trendGroups.find(g => g.key === selected);
  const chartData = selectedGroup?.results.map(r => ({
    date: r.report_date,
    value: r.result_numeric,
    unit: r.unit,
  })) || [];

  const rangeRef = selectedGroup?.results[0];
  const rangeLow = rangeRef?.range_low;
  const rangeHigh = rangeRef?.range_high;

  function getChange(): string | null {
    if (!selectedGroup || selectedGroup.results.length < 2) return null;
    const last = selectedGroup.results[selectedGroup.results.length - 1];
    const prev = selectedGroup.results[selectedGroup.results.length - 2];
    const delta = last.result_numeric - prev.result_numeric;
    const pct = ((delta / prev.result_numeric) * 100).toFixed(1);
    if (delta > 0) return t('trends.increased') + ` (+${pct}%)`;
    if (delta < 0) return t('trends.decreased') + ` (${pct}%)`;
    return t('trends.unchanged');
  }

  const change = getChange();

  if (trendGroups.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">{t('trends.title')}</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-teal-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <p className="empty-state-title">{t('trends.noCompatible')}</p>
          <p className="empty-state-text">{t('trends.incompatibleNote')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('trends.title')}</h1>
      </div>

      <div className="notice notice-warning" style={{marginBottom: '1.5rem'}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, marginTop: '2px'}}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p style={{fontSize: '0.875rem'}}>{t('trends.disclaimer')}</p>
      </div>

      {/* Test selector */}
      <div className="flex gap-2 flex-wrap" style={{marginBottom: '1.5rem'}}>
        {trendGroups.map(group => (
          <button
            key={group.key}
            className={`btn btn-sm ${selected === group.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelected(group.key)}
          >
            {group.label} {group.unit && `(${group.unit})`}
          </button>
        ))}
      </div>

      {selectedGroup && (
        <div className="card" style={{marginBottom: '1.5rem'}}>
          <div className="card-header">
            <div>
              <h2 style={{fontSize: '1.125rem', fontWeight: 700}}>{selectedGroup.label}</h2>
              {selectedGroup.unit && <p className="text-small text-muted">{selectedGroup.unit}</p>}
            </div>
            {change && (
              <span className={`badge ${change.includes(t('trends.increased')) ? 'badge-warning' : change.includes(t('trends.decreased')) ? 'badge-info' : 'badge-neutral'}`}>
                {change}
              </span>
            )}
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{top: 5, right: 20, left: 0, bottom: 5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="date"
                    tick={{fontSize: 12, fill: 'var(--color-text-muted)'}}
                  />
                  <YAxis
                    tick={{fontSize: 12, fill: 'var(--color-text-muted)'}}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                    }}
                    formatter={(value: any) => [`${value} ${selectedGroup.unit}`, selectedGroup.label]}
                  />
                  {rangeLow !== undefined && rangeLow !== null && (
                    <ReferenceLine
                      y={rangeLow}
                      stroke="var(--color-warning-600)"
                      strokeDasharray="4 4"
                      label={{value: 'Low', fill: 'var(--color-warning-600)', fontSize: 11}}
                    />
                  )}
                  {rangeHigh !== undefined && rangeHigh !== null && (
                    <ReferenceLine
                      y={rangeHigh}
                      stroke="var(--color-warning-600)"
                      strokeDasharray="4 4"
                      label={{value: 'High', fill: 'var(--color-warning-600)', fontSize: 11}}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-teal-600)"
                    strokeWidth={2.5}
                    dot={{fill: 'var(--color-teal-600)', strokeWidth: 0, r: 5}}
                    activeDot={{r: 7, fill: 'var(--color-teal-500)'}}
                    name={selectedGroup.label}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Data table */}
            <div style={{overflowX: 'auto', marginTop: '1rem'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem'}}>
                <thead>
                  <tr style={{background: 'var(--color-surface-subtle)'}}>
                    <th style={{padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)'}}>Date</th>
                    <th style={{padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)'}}>Result</th>
                    <th style={{padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)'}}>{t('trends.sourceRange')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGroup.results.map((r, i) => {
                    const outOfRange = r.result_numeric !== null && (
                      (r.range_low !== null && r.result_numeric < r.range_low) ||
                      (r.range_high !== null && r.result_numeric > r.range_high)
                    );
                    return (
                      <tr key={r.id} style={{borderTop: '1px solid var(--color-border)', background: i % 2 === 1 ? 'var(--color-surface-raised)' : 'transparent'}}>
                        <td style={{padding: '0.5rem 0.75rem'}}>{r.report_date}</td>
                        <td style={{padding: '0.5rem 0.75rem', color: outOfRange ? 'var(--color-error-600)' : 'inherit', fontWeight: outOfRange ? 600 : 400}}>
                          {r.result_numeric} {r.unit}
                          {outOfRange && ' ⚠'}
                        </td>
                        <td style={{padding: '0.5rem 0.75rem', color: 'var(--color-text-muted)'}}>{r.original_range || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
