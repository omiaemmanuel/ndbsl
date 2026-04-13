import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatCurrency';

interface Item {
  itemName: string;
  quantity: number;
  unitCost: number;
  specifications: string;
  link: string;
}

interface DraftData {
  title: string;
  assistantName: string;
  justification: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requiredByDate: string;
  deliveryLocation: string;
  items: Item[];
  savedAt: string;
}

const emptyItem = (): Item => ({ itemName: '', quantity: 1, unitCost: 0, specifications: '', link: '' });

function draftKey(userId: string) {
  return `nbsl_draft_req_${userId}`;
}

// ─── Approval Modal ───────────────────────────────────────────────────────────
function ApprovalModal({
  total,
  onAlreadyApproved,
  onNotYetApproved,
  onCancel,
}: {
  total: number;
  onAlreadyApproved: () => void;
  onNotYetApproved: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Professor Approval Required</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Total <span className="font-medium text-gray-700">{formatCurrency(total)}</span> exceeds the ₩20,000 threshold
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-5">
          Requests above ₩20,000 require the professor's approval before processing. Please select your situation:
        </p>

        <div className="space-y-3">
          <button
            onClick={onAlreadyApproved}
            className="w-full text-left border-2 border-green-200 bg-green-50 hover:bg-green-100 rounded-xl p-4 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-green-800 text-sm">I have already obtained approval</p>
                <p className="text-xs text-green-600 mt-0.5">Request sent to professor to confirm the approval</p>
              </div>
            </div>
          </button>

          <button
            onClick={onNotYetApproved}
            className="w-full text-left border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl p-4 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-blue-800 text-sm">I have not yet obtained approval</p>
                <p className="text-xs text-blue-600 mt-0.5">Submit for professor review — approval sought as part of the process</p>
              </div>
            </div>
          </button>
        </div>

        <button onClick={onCancel} className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700 py-2">
          Cancel — go back to edit
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NewRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [justification, setJustification] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasDraft, setHasDraft] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const grandTotal = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const needsApproval = grandTotal > 20000;

  // ── Load draft on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(draftKey(user.id));
    if (!raw) return;
    try {
      const draft: DraftData = JSON.parse(raw);
      setHasDraft(true);
      // Don't auto-load — let user choose via the banner
    } catch { /* corrupted draft */ }
  }, [user]);

  // ── Auto-save draft ───────────────────────────────────────────────────────
  const saveDraft = useCallback(() => {
    if (!user) return;
    const data: DraftData = {
      title, assistantName, justification, priority,
      requiredByDate, deliveryLocation, items,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftKey(user.id), JSON.stringify(data));
    setDraftStatus('saved');
    setTimeout(() => setDraftStatus('idle'), 2000);
  }, [user, title, assistantName, justification, priority, requiredByDate, deliveryLocation, items]);

  // Debounced auto-save on any form change
  useEffect(() => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDraftStatus('saving');
    saveTimer.current = setTimeout(saveDraft, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, assistantName, justification, priority, requiredByDate, deliveryLocation, items, saveDraft, user]);

  const loadDraft = () => {
    if (!user) return;
    const raw = localStorage.getItem(draftKey(user.id));
    if (!raw) return;
    try {
      const draft: DraftData = JSON.parse(raw);
      setTitle(draft.title);
      setAssistantName(draft.assistantName);
      setJustification(draft.justification);
      setPriority(draft.priority);
      setRequiredByDate(draft.requiredByDate);
      setDeliveryLocation(draft.deliveryLocation);
      setItems(draft.items.length > 0 ? draft.items : [emptyItem()]);
      setHasDraft(false);
      toast.success('Draft loaded');
    } catch {
      toast.error('Could not load draft');
    }
  };

  const discardDraft = () => {
    if (!user) return;
    localStorage.removeItem(draftKey(user.id));
    setHasDraft(false);
    toast('Draft discarded');
  };

  const updateItem = (idx: number, field: keyof Item, value: string | number) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (needsApproval) {
      setShowApprovalModal(true);
    } else {
      submitRequest(false);
    }
  };

  const submitRequest = async (professorApproval: boolean) => {
    setShowApprovalModal(false);
    setLoading(true);
    try {
      await api.post('/api/procurement', {
        title, assistantName: assistantName || null, justification,
        priority, requiredByDate: requiredByDate || null,
        deliveryLocation: deliveryLocation || null,
        professorApproval,
        items: items.map((i) => ({
          itemName: i.itemName, quantity: i.quantity, unitCost: i.unitCost,
          specifications: i.specifications || null, link: i.link || null,
        })),
      });
      // Clear draft on successful submission
      if (user) localStorage.removeItem(draftKey(user.id));
      toast.success('Request submitted successfully');
      navigate('/member/requests');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Procurement Request</h1>
        {/* Draft status indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {draftStatus === 'saving' && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
              Saving…
            </span>
          )}
          {draftStatus === 'saved' && (
            <span className="flex items-center gap-1 text-green-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Draft saved
            </span>
          )}
        </div>
      </div>

      {/* Draft resume banner */}
      {hasDraft && (() => {
        const raw = user ? localStorage.getItem(draftKey(user.id)) : null;
        const draft = raw ? JSON.parse(raw) as DraftData : null;
        const savedAt = draft?.savedAt ? new Date(draft.savedAt).toLocaleString('en-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        return (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-800">You have an unsaved draft</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {draft?.title ? `"${draft.title}"` : 'Untitled'} — last saved {savedAt}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={loadDraft}
                className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Resume
              </button>
              <button
                onClick={discardDraft}
                className="px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        );
      })()}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Request Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Request Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requester</label>
              <input type="text" value={user?.fullName || ''} readOnly
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assistant Name</label>
              <input type="text" value={assistantName} onChange={(e) => setAssistantName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Justification *</label>
              <textarea value={justification} onChange={(e) => setJustification(e.target.value)} required rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Required By Date</label>
              <input type="date" value={requiredByDate} onChange={(e) => setRequiredByDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Location</label>
              <input type="text" value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Items</h2>
            <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:underline">+ Add Item</button>
          </div>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="border border-gray-200 rounded-md p-4 relative">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Item Name *</label>
                    <input type="text" value={item.itemName} onChange={(e) => updateItem(idx, 'itemName', e.target.value)} required
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                    <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Unit Cost (₩)</label>
                    <input type="number" min={0} value={item.unitCost} onChange={(e) => updateItem(idx, 'unitCost', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Specifications</label>
                    <input type="text" value={item.specifications} onChange={(e) => updateItem(idx, 'specifications', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Product Link</label>
                    <input type="text" value={item.link} onChange={(e) => updateItem(idx, 'link', e.target.value)} placeholder="https://…"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-end">
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(item.quantity * item.unitCost)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex-1 text-right">
              <span className="text-lg font-bold text-gray-900">Grand Total: {formatCurrency(grandTotal)}</span>
            </div>
            {needsApproval && (
              <span className="ml-4 text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-full px-3 py-1 font-medium shrink-0">
                Professor approval required
              </span>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-between items-center gap-3">
          <button type="button" onClick={saveDraft}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Draft
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/member/requests')}
              className="px-5 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50">
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </div>
      </form>

      {showApprovalModal && (
        <ApprovalModal
          total={grandTotal}
          onAlreadyApproved={() => submitRequest(true)}
          onNotYetApproved={() => submitRequest(false)}
          onCancel={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}
