import { useEffect, useState } from 'react';
import api from '../../hooks/useApi';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  files: { id: string; filename: string | null; fileUrl: string | null }[];
}

function isNew(createdAt: string) {
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 3;
}

export default function MemberAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/announcements')
      .then((r) => setAnnouncements(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Announcements</h1>

      {announcements.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
          </svg>
          <p className="text-sm">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const open = expanded === a.id;
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpanded(open ? null : a.id)}
                  className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isNew(a.createdAt) && (
                      <span className="shrink-0 text-xs bg-primary-600 text-white font-bold px-2 py-0.5 rounded-full">New</span>
                    )}
                    <span className="font-medium text-gray-900 truncate">{a.title}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(a.createdAt).toLocaleDateString('en-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </button>

                {open && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mt-4">{a.content}</p>

                    {a.files.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">Attachments</p>
                        <div className="flex flex-wrap gap-2">
                          {a.files.map((f) => f.fileUrl && (
                            <a
                              key={f.id}
                              href={f.fileUrl.startsWith('/') ? `${API_BASE}${f.fileUrl}` : f.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                              </svg>
                              {f.filename ?? 'Download'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
