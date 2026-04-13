import { useState, useEffect, useRef, FormEvent } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';

interface Student {
  id: string;
  fullName: string;
  department?: string;
}

interface Comment {
  id: string;
  text: string;
  selectionMetadata: string | null;
  createdAt: string;
  author: { id: string; fullName: string; role: string };
  replies: { id: string; text: string; createdAt: string; author: { id: string; fullName: string; role: string } }[];
}

interface ReportImage {
  id: string;
  url: string;
  caption: string | null;
  displayOrder: number;
}

interface Report {
  id: string;
  weekStart: string;
  accomplishments: string;
  challenges: string;
  nextSteps: string;
  readingList?: string | null;
  imageUrl?: string | null;
  images: ReportImage[];
  isPublic: boolean;
  requestMeeting: boolean;
  status: string;
  isLate: boolean;
  createdAt: string;
  student: Student;
  comments: Comment[];
  meetings: { id: string; status: string; notes?: string }[];
}

interface SubmissionStatus {
  id: string;
  fullName: string;
  department?: string;
  submitted: boolean;
  reportStatus: string | null;
  isLate: boolean;
}

function weekLabel(weekStart: string) {
  const d = new Date(weekStart);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusPill({ status, isLate }: { status: string; isLate: boolean }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';
  if (isLate) return <span className={`${base} bg-red-100 text-red-700`}>Late</span>;
  if (status === 'reviewed') return <span className={`${base} bg-green-100 text-green-700`}>Reviewed</span>;
  if (status === 'discussion') return <span className={`${base} bg-blue-100 text-blue-700`}>Discussion</span>;
  return <span className={`${base} bg-yellow-100 text-yellow-700`}>Pending</span>;
}

// ── Image slideshow ───────────────────────────────────────────────────────────
function ImageSlideshow({ images }: { images: ReportImage[] }) {
  const [idx, setIdx] = useState(0);
  const API_BASE = import.meta.env.VITE_API_URL || '';
  if (images.length === 0) return null;

  const img = images[idx];
  const src = img.url.startsWith('/') ? `${API_BASE}${img.url}` : img.url;

  return (
    <div className="relative">
      <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: '140px' }}>
        <img src={src} alt={img.caption ?? `Visual ${idx + 1}`} className="w-full max-h-64 object-contain" />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg transition-colors"
              aria-label="Previous"
            >‹</button>
            <button
              onClick={() => setIdx((i) => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg transition-colors"
              aria-label="Next"
            >›</button>
          </>
        )}
      </div>
      {img.caption && <p className="text-xs text-gray-500 italic mt-1 text-center">{img.caption}</p>}
      {images.length > 1 && (
        <div className="flex justify-center gap-1 mt-1.5">
          {images.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-primary-600' : 'bg-gray-300'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Side-by-side review panel ─────────────────────────────────────────────────
function ReviewPanel({ report, onReviewed }: { report: Report; onReviewed: (id: string) => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [comments, setComments] = useState(report.comments);
  const [commentText, setCommentText] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<{ quote: string; field: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [requestingMeeting, setRequestingMeeting] = useState(false);
  const [meetingRequested, setMeetingRequested] = useState(
    report.meetings.some((m) => m.status === 'requested' || m.status === 'scheduled')
  );

  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Highlight-to-comment: listen for text selection inside the report panel
  const reportPanelRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !reportPanelRef.current) return;
    const range = sel.getRangeAt(0);
    const container = reportPanelRef.current;
    if (!container.contains(range.commonAncestorContainer)) return;

    const quote = sel.toString().trim();
    if (quote.length < 5) return;

    // Try to find which field the selection is in
    const node = range.commonAncestorContainer as HTMLElement;
    const fieldEl = node.nodeType === 3 ? node.parentElement : node;
    const fieldAttr = fieldEl?.closest('[data-field]')?.getAttribute('data-field') ?? 'report';

    setSelectedQuote({ quote, field: fieldAttr });
    commentInputRef.current?.focus();
  };

  const submitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/api/weekly-reports/${report.id}/comments`, {
        text: commentText.trim(),
        selectionMetadata: selectedQuote ?? null,
      });
      setComments((prev) => [...prev, { ...res.data, replies: [] }]);
      setCommentText('');
      setSelectedQuote(null);
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const markReviewed = async () => {
    setMarkingReviewed(true);
    try {
      await api.patch(`/api/weekly-reports/${report.id}/review`);
      onReviewed(report.id);
      toast.success('Report marked as reviewed');
    } catch {
      toast.error('Failed');
    } finally {
      setMarkingReviewed(false);
    }
  };

  const requestMeeting = async () => {
    setRequestingMeeting(true);
    try {
      await api.post(`/api/weekly-reports/${report.id}/meetings`, { notes: '' });
      setMeetingRequested(true);
      toast.success('Meeting request sent');
    } catch {
      toast.error('Failed');
    } finally {
      setRequestingMeeting(false);
    }
  };

  return (
    <div className="flex gap-0 h-full">
      {/* Left — Report content */}
      <div
        ref={reportPanelRef}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto px-6 py-5 select-text"
        title={t('pulse.highlightHint')}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400">{t('pulse.week')} {weekLabel(report.weekStart)}</p>
            <h3 className="font-semibold text-gray-900">{report.student.fullName}</h3>
            {report.student.department && (
              <p className="text-xs text-gray-400">{report.student.department}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={report.status} isLate={report.isLate} />
          </div>
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded px-2.5 py-1.5 mb-4 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('pulse.highlightHint')}
        </p>

        <div className="space-y-5">
          <section data-field="accomplishments">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('pulse.accomplishments')}</h4>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{report.accomplishments}</p>
          </section>
          <section data-field="challenges">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('pulse.challenges')}</h4>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{report.challenges}</p>
          </section>
          <section data-field="nextSteps">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('pulse.nextSteps')}</h4>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{report.nextSteps}</p>
          </section>
          {report.readingList && (
            <section data-field="readingList">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('pulse.readingList')}</h4>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{report.readingList}</p>
            </section>
          )}
          {(() => {
            const imgs = (report.images ?? []).length > 0
              ? report.images
              : report.imageUrl
                ? [{ id: 'legacy', url: report.imageUrl, caption: null, displayOrder: 0 }]
                : [];
            return imgs.length > 0 ? (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Research Visuals ({imgs.length})</h4>
                <ImageSlideshow images={imgs} />
              </section>
            ) : null;
          })()}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-gray-100">
          {report.status !== 'reviewed' && (
            <button
              onClick={markReviewed}
              disabled={markingReviewed}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {markingReviewed ? t('action.saving') : t('pulse.markReviewed')}
            </button>
          )}
          {!meetingRequested ? (
            <button
              onClick={requestMeeting}
              disabled={requestingMeeting}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {requestingMeeting ? t('action.saving') : t('pulse.requestMeetingBtn')}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 border border-green-200 text-green-700 bg-green-50 px-4 py-2 rounded-md text-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('pulse.meetingRequested')}
            </span>
          )}
        </div>
      </div>

      {/* Right — Comments */}
      <div className="w-72 border-l border-gray-200 flex flex-col bg-gray-50/50">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700">{t('pulse.comments')} ({comments.length})</h4>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {comments.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">{t('pulse.highlightHint')}</p>
          )}
          {comments.map((c) => {
            const meta = c.selectionMetadata ? (() => { try { return JSON.parse(c.selectionMetadata!); } catch { return null; } })() : null;
            return (
              <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                {meta?.quote && (
                  <blockquote className="border-l-2 border-primary-400 pl-2 text-xs text-gray-500 italic mb-2 line-clamp-3">
                    "{meta.quote}"
                  </blockquote>
                )}
                <p className="text-xs font-semibold text-gray-600 mb-1">
                  {c.author.fullName}
                  <span className="font-normal text-gray-400 ml-1">· {c.author.role === 'professor' ? 'Professor' : c.author.role}</span>
                </p>
                <p className="text-sm text-gray-800">{c.text}</p>
                {c.replies.map((r) => (
                  <div key={r.id} className="mt-2 pl-3 border-l border-gray-200">
                    <p className="text-xs font-semibold text-gray-500">{r.author.fullName}</p>
                    <p className="text-xs text-gray-700">{r.text}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* New comment input */}
        <div className="px-4 py-3 border-t border-gray-200">
          {selectedQuote && (
            <div className="mb-2 bg-primary-50 border border-primary-200 rounded px-2.5 py-1.5 text-xs text-primary-700 flex items-start gap-1.5">
              <span className="shrink-0 font-medium">{t('pulse.selectedText')}</span>
              <span className="line-clamp-2 italic">"{selectedQuote.quote}"</span>
              <button onClick={() => setSelectedQuote(null)} className="ml-auto shrink-0 text-primary-400 hover:text-primary-600">✕</button>
            </div>
          )}
          <form onSubmit={submitComment}>
            <textarea
              ref={commentInputRef}
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t('pulse.commentPlaceholder')}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="mt-2 w-full bg-primary-600 text-white py-2 rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? t('action.submitting') : t('pulse.addComment')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Professor Research Pulse page ────────────────────────────────────────
export default function ProfessorResearchPulse() {
  const { t } = useLanguage();

  const [tab, setTab] = useState<'status' | 'reports'>('status');
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus[]>([]);
  const [weekStart, setWeekStart] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/weekly-reports/submission-status'),
      api.get('/api/weekly-reports'),
    ]).then(([statusRes, reportsRes]) => {
      setSubmissionStatus(statusRes.data.data ?? []);
      setWeekStart(statusRes.data.weekStart ?? '');
      setReports(reportsRes.data.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const filteredReports = selectedStudentId
    ? reports.filter((r) => r.student.id === selectedStudentId)
    : reports;

  const markReviewed = (id: string) => {
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: 'reviewed' } : r));
    if (selectedReport?.id === id) setSelectedReport((prev) => prev ? { ...prev, status: 'reviewed' } : prev);
  };

  if (loading) {
    return <div className="text-sm text-gray-400 animate-pulse">{t('action.loading')}</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('pulse.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('pulse.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(['status', 'reports'] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === tabKey
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tabKey === 'status' ? t('pulse.thisWeek') : t('pulse.reviewAll')}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              {t('pulse.week')} {weekStart ? new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </h2>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {t('pulse.submitted')} ({submissionStatus.filter((s) => s.submitted).length})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                {t('pulse.notSubmitted')} ({submissionStatus.filter((s) => !s.submitted).length})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {submissionStatus.map((s) => (
              <div
                key={s.id}
                className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 ${
                  s.submitted ? 'border-green-200' : 'border-gray-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                  s.submitted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {s.fullName[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.fullName}</p>
                  {s.department && <p className="text-xs text-gray-400 truncate">{s.department}</p>}
                  <div className="mt-0.5">
                    {s.submitted
                      ? <StatusPill status={s.reportStatus ?? 'pending'} isLate={s.isLate} />
                      : <span className="text-xs text-gray-400">{t('pulse.notSubmitted')}</span>
                    }
                  </div>
                </div>
                {s.submitted && (
                  <button
                    onClick={() => {
                      setSelectedStudentId(s.id);
                      setTab('reports');
                    }}
                    className="ml-auto text-xs text-primary-600 hover:text-primary-800 font-medium shrink-0"
                  >
                    {t('action.view')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'reports' && !selectedReport && (
        <div>
          {/* Student filter */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={selectedStudentId ?? ''}
              onChange={(e) => setSelectedStudentId(e.target.value || null)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('pulse.allStudents')}</option>
              {[...new Map(reports.map((r) => [r.student.id, r.student])).values()].map((s) => (
                <option key={s.id} value={s.id}>{s.fullName}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400">{filteredReports.length} report(s)</span>
          </div>

          <div className="space-y-2">
            {filteredReports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r)}
                className="w-full bg-white border border-gray-200 rounded-xl px-5 py-3.5 flex items-center justify-between text-left hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.student.fullName}</p>
                  <p className="text-xs text-gray-400">{t('pulse.week')} {weekLabel(r.weekStart)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={r.status} isLate={r.isLate} />
                  {r.comments.length > 0 && (
                    <span className="text-xs text-gray-400">{r.comments.length} comments</span>
                  )}
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
            {filteredReports.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">{t('pulse.noReports')}</p>
            )}
          </div>
        </div>
      )}

      {/* Report review panel */}
      {tab === 'reports' && selectedReport && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ height: '70vh' }}>
          {/* Panel header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setSelectedReport(null)}
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('action.back')}
            </button>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-700 font-medium">{selectedReport.student.fullName}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">{t('pulse.week')} {weekLabel(selectedReport.weekStart)}</span>
          </div>
          <ReviewPanel report={selectedReport} onReviewed={markReviewed} />
        </div>
      )}
    </div>
  );
}
