import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { QueryThread, type Query } from '../../components/ui/QueryThread';
import { printRequest } from '../../utils/printRequest';

const STATUS_TABS = ['all', 'pending', 'approved', 'queried', 'declined', 'ordered', 'delivered', 'archived'];

interface ProcurementRequest {
  id: string;
  title: string;
  status: string;
  priority: string;
  totalAmount: number;
  createdAt: string;
  isArchived: boolean;
  justification: string;
  professorApproval: boolean;
  assistantName?: string | null;
  deliveryLocation?: string | null;
  requiredByDate?: string | null;
  hasUnreadMemberReply: boolean;
  requester: { fullName: string; department?: string | null };
  items: { id: string; itemName: string; quantity: number; unitCost: number; specifications?: string | null; link?: string | null }[];
}

export default function AdminRequests() {
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [queries, setQueries] = useState<Record<string, Query[]>>({});
  const [queryText, setQueryText] = useState<Record<string, string>>({});
  const [queryTarget, setQueryTarget] = useState<Record<string, 'member' | 'admin' | 'both'>>({});
  const [showThread, setShowThread] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    const params = tab !== 'all' && tab !== 'archived' ? `?status=${tab}` : tab === 'archived' ? '?archived=true' : '';
    return api.get(`/api/procurement${params}`).then((r) => setRequests(r.data.data ?? []));
  }, [tab]);

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

  const act = async (id: string, action: string, body?: Record<string, unknown>) => {
    setActing(id);
    try {
      await api.post(`/api/procurement/${id}/${action}`, body ?? {});
      toast.success('Done');
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
    const target = queryTarget[id] || 'member';
    setActing(id + '-query');
    try {
      await api.post(`/api/procurement/${id}/query`, { message, queryTarget: target });
      toast.success('Query sent');
      setQueryText((p) => ({ ...p, [id]: '' }));
      await loadQueries(id);
      await load();
      setShowThread((p) => { const n = new Set(p); n.add(id); return n; });
    } catch {
      toast.error('Failed to send query');
    } finally {
      setActing(null);
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/api/procurement/${deleteId}`, { data: { confirm: true } });
      toast.success('Deleted');
      await load();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleteId(null);
    }
  };

  const isNew24h = (d: string) => (Date.now() - new Date(d).getTime()) < 24 * 60 * 60 * 1000;

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Procurement Requests</h1>

      <div className="flex gap-1 flex-wrap mb-4">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <p className="text-gray-500 text-sm">No requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
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
                      <p className="font-medium text-gray-900 truncate">{req.title}</p>
                      {isNew24h(req.createdAt) && (
                        <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded shrink-0">New</span>
                      )}
                      {req.hasUnreadMemberReply && (
                        <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse shrink-0">Replied</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{req.requester.fullName} · {formatDate(req.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-sm font-medium">{formatCurrency(req.totalAmount)}</span>
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

                    {/* Print button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => printRequest(req)}
                        className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print / Download PDF
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {(req.status === 'pending' || req.status === 'queried') && (
                        <>
                          <button onClick={() => act(req.id, 'approve')} disabled={acting === req.id} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">Approve</button>
                          <button onClick={() => act(req.id, 'decline')} disabled={acting === req.id} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium">Decline</button>
                        </>
                      )}
                      {req.status === 'approved' && (
                        <button onClick={() => act(req.id, 'status', { status: 'ordered' })} disabled={acting === req.id} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">Mark Ordered</button>
                      )}
                      {req.status === 'ordered' && (
                        <button onClick={() => act(req.id, 'status', { status: 'delivered' })} disabled={acting === req.id} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium">Mark Delivered</button>
                      )}
                      <button onClick={() => act(req.id, 'archive', { unarchive: req.isArchived })} disabled={acting === req.id} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium">
                        {req.isArchived ? 'Unarchive' : 'Archive'}
                      </button>
                      <button onClick={() => setDeleteId(req.id)} className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 font-medium">Delete</button>
                    </div>

                    {/* Existing discussion threads */}
                    {reqQueries.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Discussion ({reqQueries.length} thread{reqQueries.length !== 1 ? 's' : ''})
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

                    {/* Send new query */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-white">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Send Query</p>
                      <div className="flex flex-wrap gap-4 mb-3">
                        {([
                          { value: 'member', label: 'To Requester', desc: 'Requester can see and reply' },
                          { value: 'admin', label: 'Internal (Admin only)', desc: 'Not visible to requester' },
                          { value: 'both', label: 'To Both', desc: 'All parties can reply' },
                        ] as const).map((opt) => (
                          <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`admin-target-${req.id}`}
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
                          placeholder="Type your message…"
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

      {deleteId && (
        <ConfirmDialog
          title="Delete Request"
          message="Deleting is permanent. Proceed?"
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
