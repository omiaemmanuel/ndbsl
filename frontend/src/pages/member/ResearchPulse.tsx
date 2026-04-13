import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ReportImage {
  id: string;
  url: string;
  caption: string | null;
  displayOrder: number;
}

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
  meetings: { id: string; status: string }[];
}

// Staged image before upload
interface StagedImage {
  file: File;
  caption: string;
  preview: string;
}

function weekLabel(weekStart: string) {
  const d = new Date(weekStart);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status, isLate }: { status: string; isLate: boolean }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';
  if (isLate) return <span className={`${base} bg-red-100 text-red-700`}>Late</span>;
  if (status === 'reviewed') return <span className={`${base} bg-green-100 text-green-700`}>Reviewed</span>;
  if (status === 'discussion') return <span className={`${base} bg-blue-100 text-blue-700`}>Discussion</span>;
  return <span className={`${base} bg-yellow-100 text-yellow-700`}>Pending Review</span>;
}

// ── ImageSlideshow ────────────────────────────────────────────────────────────
function ImageSlideshow({ images }: { images: ReportImage[] }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;

  const img = images[idx];
  const imgSrc = img.url.startsWith('/') ? `${API_BASE}${img.url}` : img.url;

  return (
    <div className="relative">
      <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: '160px' }}>
        <img
          src={imgSrc}
          alt={img.caption ?? `Research visual ${idx + 1}`}
          className="w-full max-h-72 object-contain"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}
      </div>
      {img.caption && (
        <p className="text-xs text-gray-500 italic mt-1 text-center">{img.caption}</p>
      )}
      {images.length > 1 && (
        <div className="flex justify-center gap-1 mt-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-primary-600' : 'bg-gray-300'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── CommentThread ─────────────────────────────────────────────────────────────
function CommentThread({ comment, reportId }: { comment: Comment; reportId: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const meta = comment.selectionMetadata ? (() => {
    try { return JSON.parse(comment.selectionMetadata!); } catch { return null; }
  })() : null;

  const submitReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/api/weekly-reports/${reportId}/comments`, {
        text: replyText.trim(),
        parentCommentId: comment.id,
      });
      setReplyText('');
      setShowReply(false);
      toast.success('Reply added');
    } catch {
      toast.error('Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0 text-xs font-bold text-primary-700">
        {comment.author.fullName[0]}
      </div>
      <div className="flex-1">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          {meta?.quote && (
            <blockquote className="border-l-2 border-primary-400 pl-2 text-xs text-gray-500 italic mb-1.5 line-clamp-2">
              "{meta.quote}"
            </blockquote>
          )}
          <p className="text-xs font-semibold text-gray-700 mb-0.5">
            {comment.author.fullName}
            <span className="font-normal text-gray-400 ml-1">
              · {comment.author.role === 'professor' ? 'Professor' : comment.author.role}
            </span>
          </p>
          <p className="text-sm text-gray-800 leading-relaxed">{comment.text}</p>
        </div>

        {/* Replies */}
        {comment.replies.map((r) => (
          <div key={r.id} className="flex gap-2 mt-2 ml-4">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600">
              {r.author.fullName[0]}
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1">
              <p className="text-xs font-semibold text-gray-700 mb-0.5">{r.author.fullName}</p>
              <p className="text-sm text-gray-800">{r.text}</p>
            </div>
          </div>
        ))}

        {/* Reply toggle */}
        {user && (
          <div className="mt-1.5 ml-1">
            {!showReply ? (
              <button onClick={() => setShowReply(true)} className="text-xs text-gray-400 hover:text-primary-600">
                Reply →
              </button>
            ) : (
              <div className="flex gap-2 mt-1.5">
                <input
                  autoFocus
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t('pulse.replyPlaceholder')}
                  className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  onClick={submitReply}
                  disabled={submitting}
                  className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {t('action.submit')}
                </button>
                <button onClick={() => setShowReply(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  {t('action.cancel')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ReportCard ────────────────────────────────────────────────────────────────
function ReportCard({ report, defaultExpanded = false }: { report: Report; defaultExpanded?: boolean }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState(report.comments);

  const allImages: ReportImage[] = report.images ?? [];
  // Fallback: if legacy imageUrl exists and no new images, display it
  const legacyImage = report.imageUrl && allImages.length === 0
    ? [{ id: 'legacy', url: report.imageUrl, caption: null, displayOrder: 0 }]
    : [];
  const displayImages = allImages.length > 0 ? allImages : legacyImage;

  const addComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/api/weekly-reports/${report.id}/comments`, { text: commentText.trim() });
      setLocalComments((prev) => [...prev, { ...res.data, replies: [] }]);
      setCommentText('');
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((x) => !x)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {t('pulse.week')} {weekLabel(report.weekStart)}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={report.status} isLate={report.isLate} />
              {report.isPublic && (
                <span className="text-xs text-gray-400">· Shared with lab</span>
              )}
              {displayImages.length > 0 && (
                <span className="text-xs text-gray-400">· {displayImages.length} image{displayImages.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {localComments.length > 0 && (
            <span className="text-xs text-gray-400">{localComments.length} comment{localComments.length !== 1 ? 's' : ''}</span>
          )}
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="mt-4 space-y-4">
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('pulse.accomplishments')}</h4>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{report.accomplishments}</p>
            </section>
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('pulse.challenges')}</h4>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{report.challenges}</p>
            </section>
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('pulse.nextSteps')}</h4>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{report.nextSteps}</p>
            </section>
            {report.readingList && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('pulse.readingList')}</h4>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{report.readingList}</p>
              </section>
            )}
            {displayImages.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Research Visuals</h4>
                <ImageSlideshow images={displayImages} />
              </section>
            )}
          </div>

          {/* Comments */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('pulse.comments')} ({localComments.length})</h4>
            <div className="space-y-4">
              {localComments.map((c) => (
                <CommentThread key={c.id} comment={c} reportId={report.id} />
              ))}
            </div>

            {user && (
              <form onSubmit={addComment} className="flex gap-2 mt-4">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('pulse.commentPlaceholder')}
                  className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? t('action.submitting') : t('pulse.addComment')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Multi-image picker ────────────────────────────────────────────────────────
function ImagePicker({ staged, onChange }: {
  staged: StagedImage[];
  onChange: (images: StagedImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newStaged = files.map((file) => ({
      file,
      caption: '',
      preview: URL.createObjectURL(file),
    }));
    onChange([...staged, ...newStaged]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (idx: number) => {
    URL.revokeObjectURL(staged[idx].preview);
    onChange(staged.filter((_, i) => i !== idx));
  };

  const updateCaption = (idx: number, caption: string) => {
    onChange(staged.map((s, i) => i === idx ? { ...s, caption } : s));
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Images
        </button>
        {staged.length > 0 && (
          <span className="text-xs text-gray-400">{staged.length} image{staged.length !== 1 ? 's' : ''} selected</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        multiple
        onChange={addFiles}
        className="hidden"
      />
      {staged.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {staged.map((s, i) => (
            <div key={i} className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img src={s.preview} alt="" className="w-full h-28 object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black/70"
                aria-label="Remove image"
              >
                ×
              </button>
              <div className="p-2">
                <input
                  type="text"
                  value={s.caption}
                  onChange={(e) => updateCaption(i, e.target.value)}
                  placeholder="Caption (optional)"
                  maxLength={120}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MemberResearchPulse() {
  const { t } = useLanguage();

  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [submittedThisWeek, setSubmittedThisWeek] = useState(false);

  // Form state
  const [accomplishments, setAccomplishments] = useState('');
  const [challenges, setChallenges] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [readingList, setReadingList] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [requestMeeting, setRequestMeeting] = useState(false);
  const [staged, setStaged] = useState<StagedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/api/weekly-reports')
      .then((res) => {
        const list: Report[] = res.data.data ?? [];
        setReports(list);
        const monday = getThisMonday();
        setSubmittedThisWeek(
          list.some((r) => new Date(r.weekStart).getTime() === monday.getTime())
        );
      })
      .finally(() => setLoadingReports(false));
  }, []);

  function getThisMonday(): Date {
    const d = new Date();
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Create the report
      const res = await api.post('/api/weekly-reports', {
        accomplishments: accomplishments.trim(),
        challenges: challenges.trim(),
        nextSteps: nextSteps.trim(),
        readingList: readingList.trim() || null,
        isPublic,
        requestMeeting,
      });

      const newReport: Report = { ...res.data, images: [] };

      // 2. Upload images one by one and attach to report
      for (let i = 0; i < staged.length; i++) {
        const s = staged[i];
        const fd = new FormData();
        fd.append('file', s.file);
        const uploadRes = await api.post('/api/files/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const imgRes = await api.post(`/api/weekly-reports/${newReport.id}/images`, {
          url: uploadRes.data.url,
          caption: s.caption || null,
          displayOrder: i,
        });
        newReport.images.push(imgRes.data);
      }

      setReports((prev) => [newReport, ...prev]);
      setSubmittedThisWeek(true);

      // Reset form
      setAccomplishments('');
      setChallenges('');
      setNextSteps('');
      setReadingList('');
      setIsPublic(false);
      setRequestMeeting(false);
      staged.forEach((s) => URL.revokeObjectURL(s.preview));
      setStaged([]);

      toast.success('Weekly report submitted!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('pulse.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('pulse.subtitle')}</p>
      </div>

      {/* Submit form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t('pulse.submitReport')}</h2>

        {submittedThisWeek ? (
          <div className="flex items-center gap-2 py-4 text-sm text-green-700 bg-green-50 rounded-lg px-4 mt-3">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('pulse.alreadySubmitted')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('pulse.accomplishments')} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={accomplishments}
                onChange={(e) => setAccomplishments(e.target.value)}
                placeholder={t('pulse.accomplishmentsPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('pulse.challenges')} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                placeholder={t('pulse.challengesPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('pulse.nextSteps')} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                placeholder={t('pulse.nextStepsPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('pulse.readingList')}</label>
              <textarea
                rows={2}
                value={readingList}
                onChange={(e) => setReadingList(e.target.value)}
                placeholder={t('pulse.readingListPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Research Visuals <span className="text-gray-400 font-normal">(optional, multiple images)</span>
              </label>
              <ImagePicker staged={staged} onChange={setStaged} />
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 leading-snug">{t('pulse.shareWithLab')}</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requestMeeting}
                  onChange={(e) => setRequestMeeting(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 leading-snug">{t('pulse.requestMeeting')}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? t('action.submitting') : t('pulse.submitBtn')}
            </button>
          </form>
        )}
      </div>

      {/* History / Progress Gallery */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t('pulse.history')}</h2>

        {loadingReports ? (
          <div className="text-sm text-gray-400 animate-pulse">{t('action.loading')}</div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-gray-500">{t('pulse.noReports')}</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-4 pl-10">
              {reports.map((r, i) => (
                <div key={r.id} className="relative">
                  <div className={`absolute -left-10 top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm
                    ${r.status === 'reviewed' ? 'bg-green-500' : r.isLate ? 'bg-red-400' : 'bg-primary-500'}`} />
                  <ReportCard report={r} defaultExpanded={i === 0} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
