import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';

interface Consumable {
  id: string;
  name: string;
  category: string | null;
  currentStock: number;
  unit: string | null;
  reorderThreshold: number;
  location: string | null;
  stockStatus: string;
}

interface ConsumableRequest {
  id: string;
  requestType: string;
  itemName: string | null;
  quantity: number;
  status: string;
  createdAt: string;
  consumable: { name: string } | null;
}

export default function MemberConsumables() {
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [requests, setRequests] = useState<ConsumableRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [reqType, setReqType] = useState<'restock' | 'new_item'>('restock');
  const [selectedConsumableId, setSelectedConsumableId] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [purposeText, setPurposeText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = () => {
    return Promise.all([
      api.get('/api/consumables'),
      api.get('/api/consumables/requests'),
    ]).then(([c, r]) => {
      setConsumables(c.data.data ?? []);
      setRequests(r.data.data ?? []);
    });
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const submitRequest = async () => {
    setSubmitting(true);
    try {
      await api.post('/api/consumables/requests', {
        requestType: reqType,
        consumableId: reqType === 'restock' ? selectedConsumableId || null : null,
        itemName: reqType === 'new_item' ? itemName : null,
        category: reqType === 'new_item' ? category : null,
        unit: reqType === 'new_item' ? unit : null,
        quantity,
        purpose: purposeText || null,
      });
      toast.success('Request submitted');
      setShowModal(false);
      await fetchData();
    } catch {
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Consumables</h1>
        <button onClick={() => setShowModal(true)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">
          + Request Consumable
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Stock</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Location</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {consumables.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.category || '—'}</td>
                <td className="px-4 py-3">{c.currentStock} {c.unit}</td>
                <td className="px-4 py-3 text-gray-500">{c.location || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={c.stockStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">My Consumable Requests</h2>
      {requests.length === 0 ? (
        <p className="text-gray-500 text-sm">No requests yet.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Item</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{r.consumable?.name || r.itemName || '—'}</td>
                  <td className="px-4 py-3 capitalize">{r.requestType.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{r.quantity}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Request Consumable" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
              <select
                value={reqType}
                onChange={(e) => setReqType(e.target.value as typeof reqType)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="restock">Restock Existing</option>
                <option value="new_item">Request New Item</option>
              </select>
            </div>

            {reqType === 'restock' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Consumable</label>
                <select
                  value={selectedConsumableId}
                  onChange={(e) => setSelectedConsumableId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {consumables.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                  <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
              <textarea value={purposeText} onChange={(e) => setPurposeText(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Cancel</button>
              <button onClick={submitRequest} disabled={submitting} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
