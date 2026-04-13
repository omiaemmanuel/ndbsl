import { useEffect, useState, useCallback } from 'react';
import api from '../../hooks/useApi';
import { formatDate } from '../../utils/formatDate';
import { QueryThread, type Query } from '../../components/ui/QueryThread';

interface RequestWithQueries {
  id: string;
  title: string;
  requester: { fullName: string };
  createdAt: string;
  hasUnreadMemberReply: boolean;
}

export default function Queries() {
  const [requests, setRequests] = useState<RequestWithQueries[]>([]);
  const [queries, setQueries] = useState<Record<string, Query[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const loadAll = useCallback(async () => {
    const r = await api.get('/api/procurement');
    const allRequests: RequestWithQueries[] = r.data.data ?? [];

    // Only keep requests that have admin-visible queries (server filters by role)
    const withQueries: RequestWithQueries[] = [];
    const queriesMap: Record<string, Query[]> = {};

    await Promise.all(
      allRequests.map(async (req) => {
        try {
          const qr = await api.get(`/api/procurement/${req.id}/queries`);
          const qs: Query[] = qr.data.data ?? [];
          if (qs.length > 0) {
            withQueries.push(req);
            queriesMap[req.id] = qs;
          }
        } catch { /* skip */ }
      })
    );

    setRequests(withQueries);
    setQueries(queriesMap);
  }, []);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  const loadQueries = useCallback(async (requestId: string) => {
    try {
      const r = await api.get(`/api/procurement/${requestId}/queries`);
      setQueries((p) => ({ ...p, [requestId]: r.data.data ?? [] }));
    } catch { /* ignore */ }
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Professor Queries</h1>
          <p className="text-sm text-gray-500 mt-0.5">Threads directed to admin or both parties</p>
        </div>
        <button onClick={() => setShowArchived((v) => !v)} className="text-sm text-primary-600 hover:underline">
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No admin-visible query threads.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const reqQueries = queries[req.id] ?? [];
            const hasUnread = req.hasUnreadMemberReply;
            const isOpen = expanded.has(req.id);

            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggle(req.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 truncate">{req.title}</p>
                      {hasUnread && (
                        <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse shrink-0">Replied</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {req.requester.fullName} · {formatDate(req.createdAt)} · {reqQueries.length} thread{reqQueries.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <QueryThread
                      requestId={req.id}
                      queries={reqQueries}
                      onUpdated={() => { loadQueries(req.id); loadAll(); }}
                    />
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
