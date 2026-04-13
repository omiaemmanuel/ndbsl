import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ViewToggle } from '../../components/ui/ViewToggle';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { QueryThread, type Query } from '../../components/ui/QueryThread';
import { printRequest } from '../../utils/printRequest';

interface ProcurementItem {
  id: string; itemName: string; quantity: number; unitCost: number;
  specifications: string | null; link: string | null;
}

interface Request {
  id: string; title: string; status: string; priority: string;
  totalAmount: number; createdAt: string; justification: string;
  professorApproval: boolean;
  assistantName?: string | null;
  deliveryLocation?: string | null;
  requiredByDate?: string | null;
  hasUnreadProfMessage: boolean; items: ProcurementItem[];
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function MyRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [discussionOpen, setDiscussionOpen] = useState<Set<string>>(new Set());
  const [queries, setQueries] = useState<Record<string, Query[]>>({});
  const [view, setView] = useState<'grid' | 'list'>('list');

  const loadRequests = useCallback(() => {
    return api.get('/api/procurement').then((r) => setRequests(r.data.data ?? []));
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

  const toggle = (id: string) => setExpanded((p) => {
    const n = new Set(p);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const openDiscussion = (id: string) => {
    setDiscussionOpen((p) => {
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">{requests.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle view={view} onChange={setView} />
          <Link to="/member/requests/new" className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
            + New Request
          </Link>
        </div>
      </div>

      {requests.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p className="text-sm">No requests yet. <Link to="/member/requests/new" className="text-primary-600 hover:underline">Create your first request</Link></p>
        </div>
      )}

      {/* Grid View */}
      {view === 'grid' && requests.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-semibold text-gray-900 text-sm line-clamp-2 cursor-pointer" onClick={() => toggle(req.id)}>{req.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(req.createdAt)}</p>
                </div>
                {req.hasUnreadProfMessage && (
                  <span className="shrink-0 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">!</span>
                )}
              </div>
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={req.status} />
                <span className="text-sm font-bold text-gray-800">{formatCurrency(req.totalAmount)}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[req.priority] || PRIORITY_COLOR.normal}`}>
                {req.priority}
              </span>
              {/* Show discussion button whenever there might be threads (always allow opening) */}
              <button
                onClick={() => openDiscussion(req.id)}
                className="mt-3 w-full text-xs text-purple-600 border border-purple-200 rounded-lg py-1.5 hover:bg-purple-50 transition-colors font-medium"
              >
                {discussionOpen.has(req.id) ? 'Hide Discussion' : req.status === 'queried' ? 'View Discussion →' : 'Discussion →'}
              </button>
              {discussionOpen.has(req.id) && (
                <div className="mt-3">
                  <QueryThread
                    requestId={req.id}
                    queries={queries[req.id] ?? []}
                    onUpdated={() => { loadQueries(req.id); loadRequests(); }}
                    compact
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && requests.length > 0 && (
        <div className="space-y-2">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer"
                onClick={() => toggle(req.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 truncate">{req.title}</p>
                      {req.hasUnreadProfMessage && (
                        <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">New</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(req.createdAt)} · {req.items.length} items</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium hidden sm:block ${PRIORITY_COLOR[req.priority] || PRIORITY_COLOR.normal}`}>{req.priority}</span>
                  <span className="text-sm font-semibold text-gray-800">{formatCurrency(req.totalAmount)}</span>
                  <StatusBadge status={req.status} />
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded.has(req.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>

              {expanded.has(req.id) && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-4"><span className="font-medium">Justification:</span> {req.justification}</p>
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-200">
                          <th className="text-left py-1.5">Item</th>
                          <th className="text-right py-1.5">Qty</th>
                          <th className="text-right py-1.5">Unit Cost</th>
                          <th className="text-right py-1.5">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {req.items.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100">
                            <td className="py-2">
                              <p>{item.itemName}</p>
                              {item.specifications && <p className="text-xs text-gray-400">{item.specifications}</p>}
                              {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">View product →</a>}
                            </td>
                            <td className="text-right py-2">{item.quantity}</td>
                            <td className="text-right py-2">{formatCurrency(item.unitCost)}</td>
                            <td className="text-right py-2 font-medium">{formatCurrency(item.quantity * item.unitCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr><td colSpan={3} className="pt-2 text-right font-semibold text-sm">Total</td><td className="pt-2 text-right font-bold">{formatCurrency(req.totalAmount)}</td></tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Print button */}
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => printRequest({ ...req, requester: { fullName: user?.fullName ?? '', department: null } })}
                      className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print / Download PDF
                    </button>
                  </div>

                  {/* Discussion threads — visible for all statuses */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-purple-700 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        {req.status === 'queried' ? 'You have a query from the professor' : 'Discussion'}
                      </p>
                      <button
                        onClick={() => openDiscussion(req.id)}
                        className="text-xs text-purple-600 border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-50 transition-colors font-medium"
                      >
                        {discussionOpen.has(req.id) ? 'Hide' : 'View →'}
                      </button>
                    </div>

                    {discussionOpen.has(req.id) && (
                      <QueryThread
                        requestId={req.id}
                        queries={queries[req.id] ?? []}
                        onUpdated={() => { loadQueries(req.id); loadRequests(); }}
                      />
                    )}
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
