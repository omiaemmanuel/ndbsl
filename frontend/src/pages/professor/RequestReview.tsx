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
  createdAt: string;
  professorApproval: boolean;
  hasUnreadMemberReply: boolean;
  requester: { fullName: string };
  items: { id: string; itemName: string; quantity: number; unitCost: number }[];
}

export default function RequestReview() {
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [queries, setQueries] = useState<Record<string, Query[]>>({});
  const [queryText, setQueryText] = useState<Record<string, string>>({});
  const [queryTarget, setQueryTarget] = useState<Record<string, 'member' | 'admin' | 'both'>>({});
  const [acting, setActing] = useState<string | null>(null);

  const loadRequests = useCallback(() => {
    return Promise.all([
      api.get('/api/procurement?status=pending'),
      api.get('/api/procurement?status=queried'),
    ]).then(([pending, queried]) => {
      setRequests([...(pending.data.data ?? []), ...(queried.data.data ?? [])]);
    });
  }, []);

  useEffect(() => {
    loadRequests().finally(() => setLoading(false));
  }, [loadRequests]);

  const loadQueries = useCallback(async (requestId: string) => {
    try {
      const r = await api.get(`/api/procurement/${requestId}/queries`);
      setQueries((p) => ({ ...p, [requestId]: r.data.data ?? [] }));
    } catch { /* ignore */ }
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        loadQueries(id);
      }
      return next;
    });
  };

  const approve = async (id: string) => {
    setActing(id);
    try {
      await api.post(`/api/procurement/${id}/approve`);
      toast.success('Request approved');
      loadRequests();
    } catch { toast.error('Failed'); }
    finally { setActing(null); }
  };

  const decline = async (id: string) => {
    setActing(id);
    try {
      await api.post(`/api/procurement/${id}/decline`);
      toast.success('Request declined');
      loadRequests();
    } catch { toast.error('Failed'); }
    finally { setActing(null); }
  };

  const sendQuery = async (id: string) => {
    const message = queryText[id]?.trim();
    if (!message) return;
    const target = queryTarget[id] || 'member';
    setActing(id + '-query');
    try {
      await api.post(`/api/procurement/${id}/query`, { message, queryTarget: target });
      toast.success('Query sent');
      setQueryText((p) => ({ ...p, [id]: '' }));
      loadRequests();
      loadQueries(id);
    } catch { toast.error('Failed to send query'); }
    finally { setActing(null); }
  };

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Request Review</h1>

      {requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No pending or queried requests.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(req.id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{req.title}</p>
                    {req.hasUnreadMemberReply && (
                      <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">Replied</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{req.requester.fullName} · {formatDate(req.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-sm font-medium text-gray-800">{formatCurrency(req.totalAmount)}</span>
                  <StatusBadge status={req.status} />
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded.has(req.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>

              {expanded.has(req.id) && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                  {/* Details */}
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
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

                  {/* Approve / Decline */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => approve(req.id)} disabled={acting === req.id}
                      className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                      Approve
                    </button>
                    <button onClick={() => decline(req.id)} disabled={acting === req.id}
                      className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium">
                      Decline
                    </button>
                  </div>

                  {/* Existing query threads */}
                  {(queries[req.id]?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Discussion Threads</p>
                      <QueryThread
                        requestId={req.id}
                        queries={queries[req.id]}
                        onUpdated={() => { loadQueries(req.id); loadRequests(); }}
                      />
                    </div>
                  )}

                  {/* New query */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Send New Query</p>

                    {/* Target selector */}
                    <div className="flex flex-wrap gap-4 mb-3">
                      {([
                        { value: 'member', label: 'To Requester', desc: 'Requester can see and reply' },
                        { value: 'admin', label: 'To Admin only', desc: 'Private — requester cannot see' },
                        { value: 'both', label: 'To Both', desc: 'Admin and requester can reply' },
                      ] as const).map((opt) => (
                        <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`target-${req.id}`}
                            value={opt.value}
                            checked={(queryTarget[req.id] || 'member') === opt.value}
                            onChange={() => setQueryTarget((p) => ({ ...p, [req.id]: opt.value }))}
                            className="mt-0.5 text-primary-600"
                          />
                          <span className="text-sm">
                            <span className="font-medium text-gray-700">{opt.label}</span>
                            <span className="text-xs text-gray-400 block">{opt.desc}</span>
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        placeholder="Type your query…"
                        value={queryText[req.id] || ''}
                        onChange={(e) => setQueryText((p) => ({ ...p, [req.id]: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        onClick={() => sendQuery(req.id)}
                        disabled={!queryText[req.id]?.trim() || acting === req.id + '-query'}
                        className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium self-end"
                      >
                        Send Query
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
