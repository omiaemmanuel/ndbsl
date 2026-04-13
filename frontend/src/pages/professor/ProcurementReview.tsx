import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { QueryThread, type Query } from '../../components/ui/QueryThread';

interface ProcurementRequest {
  id: string;
  title: string;
  status: string;
  priority: string;
  totalAmount: number;
  justification: string;
  professorApproval: boolean;
  createdAt: string;
  isArchived: boolean;
  hasUnreadMemberReply: boolean;
  requester: { fullName: string };
  items: { id: string; itemName: string; quantity: number; unitCost: number }[];
}

const ALL_STATUSES = ['pending', 'queried', 'approved', 'ordered', 'delivered', 'declined'];

export default function ProcurementReview() {
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [queries, setQueries] = useState<Record<string, Query[]>>({});
  const [queryText, setQueryText] = useState<Record<string, string>>({});
  const [showThread, setShowThread] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const results = await Promise.all(
      ALL_STATUSES.map((s) => api.get(`/api/procurement?status=${s}`).then((r) => r.data.data ?? []))
    );
    setRequests(results.flat());
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const loadQueries = useCallback(async (requestId: string) => {
    try {
      const r = await api.get(`/api/procurement/${requestId}/queries`);
      setQueries((p) => ({ ...p, [requestId]: r.data.data ?? [] }));
    } catch { /* ignore */ }
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
        loadQueries(id);
      }
      return n;
    });
  };

  const archive = async (id: string) => {
    setActing(id);
    try {
      await api.post(`/api/procurement/${id}/archive`);
      toast.success('Archived');
      await load();
    } catch {
      toast.error('Failed');
    } finally {
      setActing(null);
    }
  };

  const sendQuery = async (id: string) => {
    const message = queryText[id]?.trim();
    if (!message) return;
    setActing(id + '-query');
    try {
      // Professor queries to admin are always admin-targeted from this view
      await api.post(`/api/procurement/${id}/query`, { message, queryTarget: 'admin' });
      toast.success('Query submitted to admin');
      setQueryText((p) => ({ ...p, [id]: '' }));
      await loadQueries(id);
      await load();
      setShowThread((p) => { const n = new Set(p); n.add(id); return n; });
    } catch {
      toast.error('Failed');
    } finally {
      setActing(null);
    }
  };

  const visible = requests.filter((r) => r.isArchived === showArchived);

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement Review</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full history of all requests</p>
        </div>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="text-sm text-primary-600 hover:underline"
        >
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-gray-500 text-sm">No requests to show.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((req) => {
            const isExpanded = expanded.has(req.id);
            const reqQueries = queries[req.id] ?? [];
            const threadVisible = showThread.has(req.id);

            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(req.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900">{req.title}</p>
                      {req.hasUnreadMemberReply && (
                        <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse shrink-0">Replied</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{req.requester.fullName} · {formatDate(req.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-sm font-medium text-gray-800">{formatCurrency(req.totalAmount)}</span>
                    <StatusBadge status={req.status} />
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                    <div className="text-sm text-gray-600 bg-white rounded-lg p-3 border border-gray-200">
                      <p><span className="font-medium">Justification:</span> {req.justification}</p>
                      {req.professorApproval && (
                        <p className="mt-1 text-green-700 text-xs font-medium">✓ Professor approval obtained</p>
                      )}
                    </div>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-200">
                          <th className="text-left py-1.5">Item</th>
                          <th className="text-right py-1.5">Qty</th>
                          <th className="text-right py-1.5">Unit</th>
                          <th className="text-right py-1.5">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {req.items.map((i) => (
                          <tr key={i.id} className="border-b border-gray-100">
                            <td className="py-1.5">{i.itemName}</td>
                            <td className="text-right py-1.5">{i.quantity}</td>
                            <td className="text-right py-1.5">{formatCurrency(i.unitCost)}</td>
                            <td className="text-right py-1.5 font-medium">{formatCurrency(i.quantity * i.unitCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="pt-2 text-right font-semibold text-sm text-gray-700">Total</td>
                          <td className="pt-2 text-right font-bold">{formatCurrency(req.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => archive(req.id)}
                        disabled={acting === req.id}
                        className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium"
                      >
                        {req.isArchived ? 'Unarchive' : 'Archive'}
                      </button>
                    </div>

                    {/* Discussion threads — all threads visible to professor */}
                    {reqQueries.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Discussion history ({reqQueries.length} thread{reqQueries.length !== 1 ? 's' : ''})
                          </p>
                          <button
                            onClick={() => setShowThread((p) => { const n = new Set(p); n.has(req.id) ? n.delete(req.id) : n.add(req.id); return n; })}
                            className="text-xs text-purple-600 hover:underline"
                          >
                            {threadVisible ? 'Hide' : 'Show threads →'}
                          </button>
                        </div>
                        {threadVisible && (
                          <QueryThread
                            requestId={req.id}
                            queries={reqQueries}
                            onUpdated={() => { loadQueries(req.id); load(); }}
                          />
                        )}
                      </div>
                    )}

                    {/* Submit query to admin */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-white">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Send Query to Admin</p>
                      <p className="text-xs text-gray-400 mb-3">Visible to admin only — not the requester</p>
                      <div className="flex gap-2">
                        <textarea
                          rows={2}
                          placeholder="Type your query to admin…"
                          value={queryText[req.id] || ''}
                          onChange={(e) => setQueryText((p) => ({ ...p, [req.id]: e.target.value }))}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                          onClick={() => sendQuery(req.id)}
                          disabled={!queryText[req.id]?.trim() || acting === req.id + '-query'}
                          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium self-end"
                        >
                          Send
                        </button>
                      </div>
                    </div>
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
