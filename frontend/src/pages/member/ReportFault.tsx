import { useEffect, useState, useRef, FormEvent } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../../components/ui/StatusBadge';

interface Equipment { id: string; name: string; status: string; }

interface FaultMessage {
  id: string; body: string; createdAt: string;
  sender: { id: string; fullName: string; role: string };
}

interface MyFault {
  id: string; severity: string; description: string; status: string;
  reporterUsable: boolean; adminUsable: boolean | null;
  createdAt: string;
  equipment: { id: string; name: string; bookingDisabled: boolean };
  messages: FaultMessage[];
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-blue-600', medium: 'text-yellow-600', high: 'text-orange-600', critical: 'text-red-600',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ReportFault() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [description, setDescription] = useState('');
  const [reporterUsable, setReporterUsable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [myFaults, setMyFaults] = useState<MyFault[]>([]);
  const [faultsLoading, setFaultsLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const bottomRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadFaults = () =>
    api.get('/api/faults').then((r) => setMyFaults(r.data.data ?? []));

  useEffect(() => {
    api.get('/api/equipment').then((r) => setEquipment(r.data.data ?? []));
    loadFaults().finally(() => setFaultsLoading(false));
  }, []);

  useEffect(() => {
    if (expanded) setTimeout(() => bottomRefs.current[expanded]?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [expanded, myFaults]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/faults', { equipmentId, severity, description, reporterUsable });
      setSubmitted(true);
      setEquipmentId(''); setSeverity('medium'); setDescription(''); setReporterUsable(true);
      await loadFaults();
      toast.success('Fault report submitted — admin has been notified');
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      toast.error('Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async (faultId: string) => {
    const body = replyText[faultId]?.trim();
    if (!body) return;
    setSending(faultId);
    try {
      await api.post(`/api/faults/${faultId}/messages`, { body });
      setReplyText((p) => ({ ...p, [faultId]: '' }));
      await loadFaults();
    } catch { toast.error('Failed to send'); }
    finally { setSending(null); }
  };

  const handleKey = (e: React.KeyboardEvent, faultId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(faultId); }
  };

  const severityInfo: Record<string, { hint: string }> = {
    low:      { hint: 'Minor issue, equipment still fully functional' },
    medium:   { hint: 'Partial issue, usable with caution' },
    high:     { hint: 'Significant issue, use may be unsafe' },
    critical: { hint: 'Equipment broken or dangerous — bookings auto-disabled' },
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Report form */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Report a Fault</h1>
        <p className="text-sm text-gray-500 mb-6">Admin will review your report and follow up via the discussion thread.</p>

        {submitted && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-green-700 text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Report submitted! Admin has been notified.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment *</label>
            <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">— Select equipment —</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((s) => (
                <label key={s} className={`flex flex-col gap-0.5 border rounded-lg p-3 cursor-pointer transition-all ${
                  severity === s
                    ? `border-2 ${s === 'critical' ? 'border-red-400 bg-red-50' : s === 'high' ? 'border-orange-400 bg-orange-50' : s === 'medium' ? 'border-yellow-400 bg-yellow-50' : 'border-blue-400 bg-blue-50'}`
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="severity" value={s} checked={severity === s} onChange={() => setSeverity(s)} className="sr-only" />
                    <span className={`text-sm font-semibold capitalize ${severity === s ? SEVERITY_COLORS[s] : 'text-gray-700'}`}>{s}</span>
                  </div>
                  <span className="text-xs text-gray-400 leading-snug">{severityInfo[s].hint}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Describe the fault in detail — what happened, when, any error messages…" />
          </div>

          <div className={`rounded-lg border p-4 ${reporterUsable ? 'border-gray-200 bg-gray-50' : 'border-orange-200 bg-orange-50'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={!reporterUsable} onChange={(e) => setReporterUsable(!e.target.checked)}
                className="mt-0.5 w-4 h-4 text-orange-600 rounded" />
              <div>
                <span className="text-sm font-medium text-gray-800">I believe this equipment is currently NOT usable</span>
                <p className="text-xs text-gray-500 mt-0.5">Admin will make the final decision on booking access.</p>
                {!reporterUsable && (
                  <p className="text-xs text-orange-700 font-medium mt-1">⚠ You've flagged this as not usable — admin will be notified urgently.</p>
                )}
              </div>
            </label>
          </div>

          <button type="submit" disabled={loading || !equipmentId || !description.trim()}
            className="w-full bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
            {loading ? 'Submitting…' : 'Submit Fault Report'}
          </button>
        </form>
      </div>

      {/* My existing fault reports */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">My Fault Reports</h2>
        {faultsLoading ? (
          <div className="text-gray-400 text-sm animate-pulse">Loading…</div>
        ) : myFaults.length === 0 ? (
          <p className="text-sm text-gray-400">No fault reports yet.</p>
        ) : (
          <div className="space-y-3">
            {myFaults.map((f) => {
              const isOpen = expanded === f.id;
              const hasAdminReply = f.messages.some((m) => ['admin', 'super_admin'].includes(m.sender.role));
              return (
                <div key={f.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setExpanded(isOpen ? null : f.id)}
                    className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-gray-900">{f.equipment.name}</span>
                        <span className={`text-xs font-bold uppercase ${SEVERITY_COLORS[f.severity]}`}>{f.severity}</span>
                        <StatusBadge status={f.status} />
                        {f.equipment.bookingDisabled && (
                          <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-medium">Bookings Disabled</span>
                        )}
                        {hasAdminReply && (
                          <span className="text-xs bg-primary-100 text-primary-700 border border-primary-200 rounded-full px-2 py-0.5 font-medium">Admin replied</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatTime(f.createdAt)}
                        {f.adminUsable !== null && (
                          <span className={`ml-2 font-medium ${f.adminUsable ? 'text-green-600' : 'text-red-600'}`}>
                            · Admin: {f.adminUsable ? 'Marked usable' : 'Marked NOT usable'}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                      </svg>
                      {f.messages.length}
                      <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50">
                      {/* Messages */}
                      <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
                        {f.messages.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">No messages yet. You can leave a note below.</p>
                        ) : f.messages.map((msg) => {
                          const isMe = user?.id === msg.sender.id;
                          const isAdmin = ['admin', 'super_admin'].includes(msg.sender.role);
                          return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`flex items-center gap-1.5 text-xs text-gray-400 ${isMe ? 'flex-row-reverse' : ''}`}>
                                  <span className="font-semibold text-gray-700">{isMe ? 'You' : msg.sender.fullName}</span>
                                  {isAdmin && !isMe && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">Admin</span>}
                                  <span>·</span>
                                  <span>{formatTime(msg.createdAt)}</span>
                                </div>
                                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                                  isMe ? 'bg-primary-600 text-white rounded-br-sm' :
                                  isAdmin ? 'bg-orange-50 text-gray-800 border border-orange-200 rounded-bl-sm' :
                                  'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                                }`}>
                                  {msg.body}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={(el) => { bottomRefs.current[f.id] = el; }} />
                      </div>

                      {/* Reply */}
                      {f.status !== 'resolved' && (
                        <div className="px-5 pb-4">
                          <div className="flex gap-2">
                            <textarea rows={1} value={replyText[f.id] || ''}
                              onChange={(e) => setReplyText((p) => ({ ...p, [f.id]: e.target.value }))}
                              onKeyDown={(e) => handleKey(e, f.id)}
                              placeholder="Add a note or reply to admin… (Enter to send)"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white" />
                            <button onClick={() => sendReply(f.id)} disabled={!replyText[f.id]?.trim() || sending === f.id}
                              className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-40 shrink-0">
                              {sending === f.id ? '…' : 'Send'}
                            </button>
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
    </div>
  );
}
