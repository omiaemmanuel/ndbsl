import { useState, useEffect } from 'react';
import api from '../hooks/useApi';
import { useLanguage } from '../contexts/LanguageContext';

interface FeedReport {
  id: string;
  weekStart: string;
  accomplishments: string;
  isLate: boolean;
  status: string;
  createdAt: string;
  student: { id: string; fullName: string; department?: string };
}

function weekLabel(weekStart: string) {
  const d = new Date(weekStart);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getMonday(offset = 0): Date {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff + offset * 7);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

interface FeedProps {
  reports: FeedReport[];
  loading: boolean;
  t: (key: string) => string;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}

function FeedCards({ reports, loading, t, expandedId, setExpandedId }: FeedProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-full mb-2" />
            <div className="h-3 bg-gray-100 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">{t('pulse.noPublicReports')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((r) => {
        const isExpanded = expandedId === r.id;
        return (
          <div key={r.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Card header */}
            <div
              className="px-5 py-4 flex items-center gap-4 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : r.id)}
            >
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0 font-bold text-primary-700">
                {r.student.fullName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{r.student.fullName}</p>
                  {r.student.department && (
                    <span className="text-xs text-gray-400">{r.student.department}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{t('pulse.week')} {weekLabel(r.weekStart)}</p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-300 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Accomplishments preview (collapsed) */}
            {!isExpanded && (
              <div className="px-5 pb-4">
                <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{r.accomplishments}</p>
              </div>
            )}

            {/* Full content (expanded) */}
            {isExpanded && (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('pulse.accomplishments')}</h4>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{r.accomplishments}</p>
                </section>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Shared inner component used by both embedded and standalone versions
function LabFeedInner({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLanguage();

  const [reports, setReports] = useState<FeedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentWeekStart = getMonday(weekOffset);
  const weekParam = currentWeekStart.toISOString().split('T')[0];

  useEffect(() => {
    setLoading(true);
    api.get(`/api/weekly-reports/feed?week=${weekParam}`)
      .then((res) => setReports(res.data.data ?? []))
      .finally(() => setLoading(false));
  }, [weekParam]);

  const weekNav = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setWeekOffset((w) => w - 1)}
        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="text-sm font-medium text-gray-700 w-44 text-center">
        {weekLabel(currentWeekStart.toISOString())}
      </span>
      <button
        onClick={() => setWeekOffset((w) => Math.min(w + 1, 0))}
        disabled={weekOffset >= 0}
        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 disabled:opacity-30"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  if (embedded) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('pulse.labFeedTitle')}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{t('pulse.labFeedSubtitle')}</p>
          </div>
          {weekNav}
        </div>
        <FeedCards reports={reports} loading={loading} t={t} expandedId={expandedId} setExpandedId={setExpandedId} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Public top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('pulse.labFeedTitle')}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{t('pulse.labFeedSubtitle')}</p>
          </div>
          {weekNav}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <FeedCards reports={reports} loading={loading} t={t} expandedId={expandedId} setExpandedId={setExpandedId} />
      </main>
    </div>
  );
}

// Standalone public route (no sidebar)
export default function LabFeed() {
  return <LabFeedInner embedded={false} />;
}

// Embedded inside member/professor layout
export function LabFeedEmbedded() {
  return <LabFeedInner embedded={true} />;
}
