import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';

interface QueryMessage {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; fullName: string; role: string };
}

export interface Query {
  id: string;
  message: string;
  queryTarget: string;
  status: string;
  createdAt: string;
  professor: { id: string; fullName: string };
  messages: QueryMessage[];
}

interface Props {
  requestId: string;
  queries: Query[];
  onUpdated: () => void;
  compact?: boolean;
}

// Calm pastel backgrounds — one per thread index, cycles if > 8 threads
const THREAD_PALETTES = [
  { bg: 'bg-purple-50',  border: 'border-purple-200', header: 'bg-purple-50/80' },
  { bg: 'bg-sky-50',     border: 'border-sky-200',    header: 'bg-sky-50/80' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200',header: 'bg-emerald-50/80' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',  header: 'bg-amber-50/80' },
  { bg: 'bg-rose-50',    border: 'border-rose-200',   header: 'bg-rose-50/80' },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200', header: 'bg-indigo-50/80' },
  { bg: 'bg-teal-50',    border: 'border-teal-200',   header: 'bg-teal-50/80' },
  { bg: 'bg-orange-50',  border: 'border-orange-200', header: 'bg-orange-50/80' },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function targetLabel(t: string) {
  if (t === 'admin') return { label: 'Admin only', cls: 'bg-orange-100 text-orange-700' };
  if (t === 'both') return { label: 'Admin & Requester', cls: 'bg-blue-100 text-blue-700' };
  return { label: 'Requester', cls: 'bg-purple-100 text-purple-700' };
}

function roleTag(role: string) {
  if (role === 'professor') return { label: 'Prof', cls: 'bg-purple-100 text-purple-700' };
  if (role === 'admin' || role === 'super_admin') return { label: 'Admin', cls: 'bg-orange-100 text-orange-700' };
  return null;
}

export function QueryThread({ requestId, queries, onUpdated, compact }: Props) {
  const { user } = useAuth();
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const bottomRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    queries.forEach((q) => {
      bottomRefs.current[q.id]?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [queries]);

  const sendMessage = async (queryId: string) => {
    const body = replyText[queryId]?.trim();
    if (!body) return;
    setSending(queryId);
    try {
      await api.post(`/api/procurement/${requestId}/queries/${queryId}/messages`, { body });
      setReplyText((p) => ({ ...p, [queryId]: '' }));
      onUpdated();
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(null);
    }
  };

  const handleKey = (e: React.KeyboardEvent, queryId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(queryId);
    }
  };

  if (queries.length === 0) return null;

  return (
    <div className={`flex gap-3 overflow-x-auto pb-1 ${compact ? '' : 'mt-2'}`}>
      {queries.map((q, threadIdx) => {
        const tl = targetLabel(q.queryTarget);
        const palette = THREAD_PALETTES[threadIdx % THREAD_PALETTES.length];
        return (
          <div key={q.id} className={`min-w-[320px] w-[320px] flex-shrink-0 border rounded-xl overflow-hidden ${palette.bg} ${palette.border}`}>
            {/* Thread header */}
            <div className={`flex items-center justify-between px-4 py-2.5 border-b ${palette.border} ${palette.header}`}>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">Thread started by {q.professor.fullName}</span>
                <span className="text-gray-300">·</span>
                <span>{formatTime(q.createdAt)}</span>
                <span className="text-gray-300">·</span>
                <span>{q.messages.length} message{q.messages.length !== 1 ? 's' : ''}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tl.cls}`}>{tl.label}</span>
            </div>

            {/* Messages */}
            <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
              {q.messages.map((msg) => {
                // isMe: true if the currently logged-in user sent this message
                const isMe = user != null && msg.sender.id === user.id;
                const tag = roleTag(msg.sender.role);

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      {/* Sender label row */}
                      <div className={`flex items-center gap-1.5 text-xs text-gray-400 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="font-semibold text-gray-700">
                          {isMe ? `${msg.sender.fullName} (You)` : msg.sender.fullName}
                        </span>
                        {tag && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tag.cls}`}>
                            {tag.label}
                          </span>
                        )}
                        <span className="text-gray-300">·</span>
                        <span>{formatTime(msg.createdAt)}</span>
                      </div>

                      {/* Bubble */}
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-primary-600 text-white rounded-br-sm'
                          : tag?.label === 'Prof'
                          ? 'bg-purple-50 text-gray-800 border border-purple-200 rounded-bl-sm'
                          : tag?.label === 'Admin'
                          ? 'bg-orange-50 text-gray-800 border border-orange-200 rounded-bl-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        {msg.body}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={(el) => { bottomRefs.current[q.id] = el; }} />
            </div>

            {/* Reply input */}
            <div className={`px-4 py-3 border-t ${palette.border}`}>
              <div className="flex gap-2">
                <textarea
                  rows={1}
                  value={replyText[q.id] || ''}
                  onChange={(e) => setReplyText((p) => ({ ...p, [q.id]: e.target.value }))}
                  onKeyDown={(e) => handleKey(e, q.id)}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={() => sendMessage(q.id)}
                  disabled={!replyText[q.id]?.trim() || sending === q.id}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-40 transition-colors shrink-0"
                >
                  {sending === q.id ? '…' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
