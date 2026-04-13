import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

const STATUS_TABS = ['pending', 'in_progress', 'resolved', 'archived'];

interface FaultMessage {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; fullName: string; role: string };
}

interface FaultReport {
  id: string;
  severity: string;
  description: string;
  status: string;
  isArchived: boolean;
  reporterUsable: boolean;
  adminUsable: boolean | null;
  createdAt: string;
  resolutionNotes: string | null;
  equipment: { id: string; name: string; bookingDisabled: boolean };
  reporter: { id: string; fullName: string; username: string; department: string | null };
  messages: FaultMessage[];
}

const SEVERITY_COLORS: Record<string, string> = {
  low:      'bg-blue-50 border-blue-200 text-blue-700',
  medium:   'bg-yellow-50 border-yellow-200 text-yellow-700',
  high:     'bg-orange-50 border-orange-200 text-orange-700',
  critical: 'bg-red-50 border-red-200 text-red-700',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminFaults() {
  const { user } = useAuth();
  const [faults, setFaults] = useState<FaultReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const bottomRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = () => {
    const params = tab === 'archived' ? '?archived=true' : `?status=${tab}`;
    return api.get(`/api/faults${params}`).then((r) => setFaults(r.data.data ?? []));
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [tab]);

  // Auto-scroll message threads to bottom when expanded
  useEffect(() => {
    if (expanded) {
      setTimeout(() => bottomRefs.current[expanded]?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [expanded, faults]);

  const setStatus = async (id: string, status: string, resolutionNotes?: string) => {
    setActing(id);
    try {
      await api.put(`/api/faults/${id}/status`, { status, resolutionNotes });
      toast.success('Updated');
      await load();
    } catch { toast.error('Failed'); }
    finally { setActing(null); }
  };

  const setUsable = async (id: string, adminUsable: boolean) => {
    setActing(id);
    try {
      await api.put(`/api/faults/${id}/usable`, { adminUsable });
      toast.success(adminUsable ? 'Equipment marked as usable — bookings re-enabled' : 'Equipment marked NOT usable — bookings disabled');
      await load();
    } catch { toast.error('Failed'); }
    finally { setActing(null); }
  };

  const archive = async (id: string, isArchived: boolean) => {
    try {
      await api.post(`/api/faults/${id}/archive`, { unarchive: isArchived });
      toast.success(isArchived ? 'Unarchived' : 'Archived');
      await load();
    } catch { toast.error('Failed'); }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/api/faults/${deleteId}`, { data: { confirm: true } });
      toast.success('Deleted'); await load();
    } catch { toast.error('Failed'); }
    finally { setDeleteId(null); }
  };

  const sendMessage = async (faultId: string) => {
    const body = replyText[faultId]?.trim();
    if (!body) return;
    setSending(faultId);
    try {
      await api.post(`/api/faults/${faultId}/messages`, { body });
      setReplyText((p) => ({ ...p, [faultId]: '' }));
      await load();
    } catch { toast.error('Failed to send'); }
    finally { setSending(null); }
  };

  const handleKey = (e: React.KeyboardEvent, faultId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(faultId); }
  };

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Fault Reports</h1>

      <div className="flex gap-1 flex-wrap mb-4">
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {faults.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No faults in this category.</p>
        ) : faults.map((f) => {
          const isExpanded = expanded === f.id;
          const sevColor = SEVERITY_COLORS[f.severity] ?? 'bg-gray-50 border-gray-200 text-gray-700';

          return (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Equipment + severity */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-semibold text-gray-900">{f.equipment.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${sevColor}`}>
                        {f.severity}
                      </span>
                      <StatusBadge status={f.status} />
                      {f.equipment.bookingDisabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 border border-red-200 text-red-700 font-semibold">
                          Bookings Disabled
                        </span>
                      )}
                    </div>

                    {/* Reporter */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary-700">{f.reporter.fullName[0]}</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        <span className="font-medium text-gray-800">{f.reporter.fullName}</span>
                        <span className="text-gray-400 ml-1">@{f.reporter.username}</span>
                        {f.reporter.department && <span className="text-gray-400 ml-1">· {f.reporter.department}</span>}
                        <span className="text-gray-400 ml-1">· {formatDate(f.createdAt)}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-700 break-words whitespace-pre-wrap leading-relaxed">{f.description}</p>

                    {/* Reporter usability flag */}
                    <div className={`mt-2 inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border font-medium ${
                      f.reporterUsable
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-orange-50 border-orange-200 text-orange-700'
                    }`}>
                      {f.reporterUsable ? '✓ Reporter: equipment still usable' : '⚠ Reporter: equipment NOT usable'}
                    </div>

                    {/* Resolution notes */}
                    {f.resolutionNotes && (
                      <div className="mt-2 text-xs text-gray-500 italic">Resolution: {f.resolutionNotes}</div>
                    )}
                  </div>

                  {/* Message count badge */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : f.id)}
                    className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                    <span>{f.messages.length} message{f.messages.length !== 1 ? 's' : ''}</span>
                    <svg className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {/* Status transitions */}
                  {f.status === 'pending' && (
                    <button onClick={() => setStatus(f.id, 'in_progress')} disabled={acting === f.id}
                      className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                      Mark In Progress
                    </button>
                  )}
                  {f.status === 'in_progress' && (
                    <button onClick={() => setStatus(f.id, 'resolved')} disabled={acting === f.id}
                      className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                      Mark Resolved
                    </button>
                  )}

                  {/* Admin usable toggle */}
                  {f.status !== 'resolved' && (
                    <>
                      <button
                        onClick={() => setUsable(f.id, true)}
                        disabled={acting === f.id || f.adminUsable === true}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-40 ${
                          f.adminUsable === true
                            ? 'bg-green-100 border-green-300 text-green-700 font-semibold'
                            : 'border-green-300 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        ✓ Mark Usable
                      </button>
                      <button
                        onClick={() => setUsable(f.id, false)}
                        disabled={acting === f.id || f.adminUsable === false}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-40 ${
                          f.adminUsable === false
                            ? 'bg-red-100 border-red-300 text-red-700 font-semibold'
                            : 'border-red-300 text-red-700 hover:bg-red-50'
                        }`}
                      >
                        ✕ Mark NOT Usable
                      </button>
                    </>
                  )}

                  <button onClick={() => archive(f.id, f.isArchived)} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    {f.isArchived ? 'Unarchive' : 'Archive'}
                  </button>
                  <button onClick={() => setDeleteId(f.id)} className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>

              {/* Message thread */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {/* Messages */}
                  <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto">
                    {f.messages.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">No messages yet. Start the follow-up conversation below.</p>
                    ) : f.messages.map((msg) => {
                      const isMe = user?.id === msg.sender.id;
                      const isAdminSender = ['admin', 'super_admin'].includes(msg.sender.role);
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`flex items-center gap-1.5 text-xs text-gray-400 ${isMe ? 'flex-row-reverse' : ''}`}>
                              <span className="font-semibold text-gray-700">{isMe ? `${msg.sender.fullName} (You)` : msg.sender.fullName}</span>
                              {isAdminSender && !isMe && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">Admin</span>
                              )}
                              <span>·</span>
                              <span>{formatTime(msg.createdAt)}</span>
                            </div>
                            <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                              isMe
                                ? 'bg-primary-600 text-white rounded-br-sm'
                                : isAdminSender
                                ? 'bg-orange-50 text-gray-800 border border-orange-200 rounded-bl-sm'
                                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                            }`}>
                              {msg.body}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={(el) => { bottomRefs.current[f.id] = el; }} />
                  </div>

                  {/* Reply input */}
                  <div className="px-5 pb-4">
                    <div className="flex gap-2">
                      <textarea
                        rows={1}
                        value={replyText[f.id] || ''}
                        onChange={(e) => setReplyText((p) => ({ ...p, [f.id]: e.target.value }))}
                        onKeyDown={(e) => handleKey(e, f.id)}
                        placeholder={`Follow up with ${f.reporter.fullName}… (Enter to send)`}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      />
                      <button
                        onClick={() => sendMessage(f.id)}
                        disabled={!replyText[f.id]?.trim() || sending === f.id}
                        className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-40 shrink-0"
                      >
                        {sending === f.id ? '…' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deleteId && (
        <ConfirmDialog title="Delete Fault Report" message="Permanently delete this fault report?" confirmLabel="Delete" danger onConfirm={doDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}
