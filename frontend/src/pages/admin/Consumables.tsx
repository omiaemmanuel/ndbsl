import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { Modal } from '../../components/ui/Modal';

interface Consumable {
  id: string; name: string; category: string | null;
  currentStock: number; unit: string | null; reorderThreshold: number;
  location: string | null; costPerUnit: number; stockStatus: string;
}

interface ConsumableRequest {
  id: string; requestType: string; quantity: number; status: string;
  itemName: string | null; purpose: string | null;
  consumable: { id: string; name: string } | null;
  requester: { fullName: string };
}

const emptyForm = () => ({ name: '', category: '', unit: '', reorderThreshold: 5, location: '', costPerUnit: 0, currentStock: 0 });

export default function AdminConsumables() {
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [requests, setRequests] = useState<ConsumableRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: Consumable } | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const loadAll = () => Promise.all([
    api.get('/api/consumables').then((r) => setConsumables(r.data.data ?? [])),
    api.get('/api/consumables/requests').then((r) => setRequests(r.data.data ?? [])),
  ]);

  useEffect(() => { loadAll().finally(() => setLoading(false)); }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (modal?.edit) {
        await api.put(`/api/consumables/${modal.edit.id}`, form);
      } else {
        await api.post('/api/consumables', form);
      }
      toast.success(modal?.edit ? 'Updated' : 'Created');
      setModal(null);
      await loadAll();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const actOnRequest = async (id: string, action: 'approve' | 'reject' | 'issue') => {
    setActing(id);
    try {
      await api.put(`/api/consumables/requests/${id}/${action}`);
      toast.success(`Request ${action}d`);
      await loadAll();
    } catch { toast.error('Failed'); }
    finally { setActing(null); }
  };

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Consumables</h1>
        <button onClick={() => { setForm(emptyForm()); setModal({ open: true }); }} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">
          + Add Consumable
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Category', 'Stock', 'Threshold', 'Location', 'Cost/Unit', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {consumables.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.category || '—'}</td>
                <td className="px-4 py-3">{c.currentStock} {c.unit}</td>
                <td className="px-4 py-3 text-gray-500">{c.reorderThreshold}</td>
                <td className="px-4 py-3 text-gray-500">{c.location || '—'}</td>
                <td className="px-4 py-3">{formatCurrency(c.costPerUnit)}</td>
                <td className="px-4 py-3"><StatusBadge status={c.stockStatus} /></td>
                <td className="px-4 py-3">
                  <button onClick={() => { setForm({ name: c.name, category: c.category || '', unit: c.unit || '', reorderThreshold: c.reorderThreshold, location: c.location || '', costPerUnit: c.costPerUnit, currentStock: c.currentStock }); setModal({ open: true, edit: c }); }} className="text-xs text-primary-600 hover:underline">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Consumable Requests</h2>
      <div className="space-y-3">
        {requests.filter((r) => r.status === 'pending').map((r) => (
          <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm text-gray-900">{r.consumable?.name || r.itemName}</p>
              <p className="text-xs text-gray-500">{r.requester.fullName} · {r.requestType.replace('_', ' ')} · qty {r.quantity}</p>
              {r.purpose && <p className="text-xs text-gray-400 mt-0.5">{r.purpose}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => actOnRequest(r.id, 'approve')} disabled={acting === r.id} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Approve</button>
              <button onClick={() => actOnRequest(r.id, 'reject')} disabled={acting === r.id} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50">Reject</button>
            </div>
          </div>
        ))}
        {requests.filter((r) => r.status === 'approved').map((r) => (
          <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm text-gray-900">{r.consumable?.name || r.itemName}</p>
              <p className="text-xs text-gray-500">{r.requester.fullName} · approved · qty {r.quantity}</p>
            </div>
            <button onClick={() => actOnRequest(r.id, 'issue')} disabled={acting === r.id} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Mark Issued</button>
          </div>
        ))}
      </div>

      {modal?.open && (
        <Modal title={modal.edit ? 'Edit Consumable' : 'New Consumable'} onClose={() => setModal(null)} size="md">
          <div className="space-y-3">
            {[
              { label: 'Name *', key: 'name' }, { label: 'Category', key: 'category' },
              { label: 'Unit', key: 'unit' }, { label: 'Location', key: 'location' },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input type="text" value={(form as Record<string, unknown>)[f.key] as string || ''} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="grid grid-cols-3 gap-3">
              {[{ label: 'Current Stock', key: 'currentStock' }, { label: 'Reorder At', key: 'reorderThreshold' }, { label: 'Cost/Unit (₩)', key: 'costPerUnit' }].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type="number" min={0} value={(form as Record<string, unknown>)[f.key] as number ?? 0} onChange={(e) => setForm((p) => ({ ...p, [f.key]: parseInt(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
