import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';

interface Stats {
  openRequests: number;
  activeBookings: number;
  availableEquipment: number;
  consumableRequests: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  files: { id: string; filename: string | null; fileUrl: string | null }[];
}

const SEEN_KEY = 'nbsl_seen_announcements';

function isNew(createdAt: string) {
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 3;
}

function getSeenIds(): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'); } catch { return []; }
}
function markSeen(ids: string[]) {
  const existing = getSeenIds();
  localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...existing, ...ids])]));
}

export default function MemberOverview() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats>({ openRequests: 0, activeBookings: 0, availableEquipment: 0, consumableRequests: 0 });
  const [loading, setLoading] = useState(true);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<Announcement[]>([]);
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [showAnnouncements, setShowAnnouncements] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/api/procurement?status=pending'),
      api.get('/api/bookings?status=confirmed'),
      api.get('/api/equipment'),
      api.get('/api/consumables/requests?status=pending'),
      api.get('/api/announcements'),
    ]).then(([proc, book, equip, cons, ann]) => {
      setStats({
        openRequests: proc.data.total ?? 0,
        activeBookings: book.data.total ?? 0,
        availableEquipment: (equip.data.data ?? []).filter((e: { status: string }) => e.status === 'available').length,
        consumableRequests: cons.data.total ?? 0,
      });

      // Show announcements not yet seen by this user AND are new (within 3 days)
      const seen = getSeenIds();
      const fresh: Announcement[] = (ann.data.data ?? []).filter(
        (a: Announcement) => !seen.includes(a.id) && isNew(a.createdAt)
      );
      if (fresh.length > 0) {
        setUnreadAnnouncements(fresh);
        setAnnouncementIdx(0);
        setShowAnnouncements(true);
      }
    }).finally(() => setLoading(false));
  }, []);

  const dismissAll = () => {
    markSeen(unreadAnnouncements.map((a) => a.id));
    setShowAnnouncements(false);
  };

  const dismissCurrent = () => {
    markSeen([unreadAnnouncements[announcementIdx].id]);
    const remaining = unreadAnnouncements.filter((_, i) => i !== announcementIdx);
    if (remaining.length === 0) { setShowAnnouncements(false); setUnreadAnnouncements([]); }
    else { setUnreadAnnouncements(remaining); setAnnouncementIdx(Math.min(announcementIdx, remaining.length - 1)); }
  };

  const API_BASE = import.meta.env.VITE_API_URL || '';

  if (loading) {
    return <div className="animate-pulse text-gray-400 text-sm">Loading…</div>;
  }

  const current = unreadAnnouncements[announcementIdx];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('dash.welcome')}, {user?.fullName}</h1>
      <p className="text-sm text-gray-500 mb-8">{t('dash.memberDashboard')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: t('dash.openRequests'), value: stats.openRequests, to: '/member/requests', color: 'text-yellow-600' },
          { label: t('dash.activeBookings'), value: stats.activeBookings, to: '/member/bookings', color: 'text-blue-600' },
          { label: t('dash.availableEquipment'), value: stats.availableEquipment, to: '/member/equipment', color: 'text-green-600' },
          { label: t('dash.consumableRequests'), value: stats.consumableRequests, to: '/member/consumables', color: 'text-purple-600' },
        ].map((w) => (
          <Link key={w.label} to={w.to} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <p className={`text-3xl font-bold ${w.color}`}>{w.value}</p>
            <p className="text-sm text-gray-500 mt-1">{w.label}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">{t('dash.quickActions')}</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/member/requests/new" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">
            {t('dash.newProcurement')}
          </Link>
          <Link to="/member/equipment" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
            {t('dash.bookEquipment')}
          </Link>
          <Link to="/member/faults" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
            {t('nav.reportFault')}
          </Link>
          <Link to="/member/announcements" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
            {t('nav.announcements')}
          </Link>
          <Link to="/member/research-pulse" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
            {t('nav.researchPulse')}
          </Link>
        </div>
      </div>

      {/* Announcement popup modal */}
      {showAnnouncements && current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-primary-600 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">New</span>
                  {unreadAnnouncements.length > 1 && (
                    <span className="text-white/70 text-xs">{announcementIdx + 1} of {unreadAnnouncements.length}</span>
                  )}
                </div>
                <h2 className="text-white font-bold text-lg leading-snug">{current.title}</h2>
                <p className="text-white/70 text-xs mt-0.5">
                  {new Date(current.createdAt).toLocaleDateString('en-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={dismissCurrent} className="text-white/60 hover:text-white mt-0.5 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 max-h-64 overflow-y-auto">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{current.content}</p>
            </div>

            {/* Attachments */}
            {current.files.length > 0 && (
              <div className="px-6 pb-2">
                <p className="text-xs font-medium text-gray-500 mb-2">Attachments</p>
                <div className="flex flex-wrap gap-2">
                  {current.files.map((f) => f.fileUrl && (
                    <a
                      key={f.id}
                      href={f.fileUrl.startsWith('/') ? `${API_BASE}${f.fileUrl}` : f.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:bg-gray-100"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                      </svg>
                      {f.filename ?? 'Attachment'}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              {unreadAnnouncements.length > 1 && (
                <div className="flex gap-1">
                  {unreadAnnouncements.map((_, i) => (
                    <button key={i} onClick={() => setAnnouncementIdx(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === announcementIdx ? 'bg-primary-600' : 'bg-gray-300 hover:bg-gray-400'}`} />
                  ))}
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                {unreadAnnouncements.length > 1 && (
                  <button onClick={dismissAll} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                    Dismiss all
                  </button>
                )}
                {announcementIdx < unreadAnnouncements.length - 1 ? (
                  <button onClick={() => { markSeen([current.id]); const idx = announcementIdx; setUnreadAnnouncements(prev => prev.filter((_, i) => i !== idx)); setAnnouncementIdx(0); }}
                    className="text-xs bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700">
                    Next →
                  </button>
                ) : (
                  <button onClick={dismissCurrent} className="text-xs bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700">
                    Got it
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
