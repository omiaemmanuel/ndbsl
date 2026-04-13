import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ViewToggle } from '../../components/ui/ViewToggle';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Room { id: string; name: string; }
interface Equipment {
  id: string; name: string; category: string | null; model: string | null;
  serialNumber: string | null; description: string | null;
  status: string; requiresApproval: boolean; imageUrl: string | null;
  manualUrl: string | null;
  room: Room | null;
}

const emptyForm = () => ({
  name: '', category: '', model: '', serialNumber: '', description: '',
  roomId: '', status: 'available', requiresApproval: false,
  maxDurationHours: 24, advanceLimitDays: 30, minNoticeHours: 1,
  manualUrl: '', imageUrl: '',
});

export default function AdminEquipment() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [modal, setModal] = useState<{ open: boolean; edit?: Equipment } | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingManual, setUploadingManual] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const loadEquipment = () =>
    api.get('/api/equipment').then((r) => {
      const eqs: Equipment[] = r.data.data ?? [];
      setEquipment(eqs);
      const roomMap = new Map<string, Room>();
      eqs.forEach((e) => { if (e.room) roomMap.set(e.room.id, e.room); });
      setRooms(Array.from(roomMap.values()));
    });

  useEffect(() => { loadEquipment().finally(() => setLoading(false)); }, []);

  const uploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/api/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((p) => ({ ...p, imageUrl: r.data.url }));
      toast.success('Image uploaded');
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploadingImg(false);
    }
  };

  const uploadManual = async (file: File) => {
    setUploadingManual(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/api/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((p) => ({ ...p, manualUrl: r.data.url }));
      toast.success('Manual uploaded');
    } catch {
      toast.error('Manual upload failed');
    } finally {
      setUploadingManual(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = {
        ...form,
        roomId: form.roomId || null,
        category: form.category || null,
        model: form.model || null,
        serialNumber: form.serialNumber || null,
        description: form.description || null,
        manualUrl: form.manualUrl || null,
        imageUrl: form.imageUrl || null,
      };
      if (modal?.edit) {
        await api.put(`/api/equipment/${modal.edit.id}`, data);
      } else {
        await api.post('/api/equipment', data);
      }
      toast.success(modal?.edit ? 'Equipment updated' : 'Equipment added');
      setModal(null);
      await loadEquipment();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/api/equipment/${deleteId}`);
      toast.success('Deleted');
      await loadEquipment();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Delete failed');
    } finally {
      setDeleteId(null);
    }
  };

  const imgSrc = (url: string | null) =>
    url ? (url.startsWith('/') ? `${API_BASE}${url}` : url) : null;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipment</h1>
          <p className="text-sm text-gray-500 mt-0.5">{equipment.length} items</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle view={view} onChange={setView} />
          <button
            onClick={() => { setForm(emptyForm()); setModal({ open: true }); }}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            + Add Equipment
          </button>
        </div>
      </div>

      {/* Grid */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {equipment.map((eq) => (
            <div key={eq.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-36 bg-gray-100 overflow-hidden">
                {imgSrc(eq.imageUrl) ? (
                  <img src={imgSrc(eq.imageUrl)!} alt={eq.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">{eq.name}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400">{eq.category}</span>
                  <StatusBadge status={eq.status} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setForm({ ...emptyForm(), name: eq.name, category: eq.category || '', model: eq.model || '', serialNumber: eq.serialNumber || '', description: eq.description || '', roomId: eq.room?.id || '', status: eq.status, requiresApproval: eq.requiresApproval, manualUrl: eq.manualUrl || '', imageUrl: eq.imageUrl || '' }); setModal({ open: true, edit: eq }); }} className="flex-1 text-xs text-primary-600 border border-primary-200 py-1.5 rounded hover:bg-primary-50">Edit</button>
                  <button onClick={() => setDeleteId(eq.id)} className="flex-1 text-xs text-red-600 border border-red-200 py-1.5 rounded hover:bg-red-50">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Equipment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Room</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {equipment.map((eq) => (
                <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        {imgSrc(eq.imageUrl) ? (
                          <img src={imgSrc(eq.imageUrl)!} alt={eq.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-300 text-xs">📷</div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{eq.name}</p>
                        {eq.description && <p className="text-xs text-gray-400 truncate max-w-xs">{eq.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{eq.category || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{eq.room?.name || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={eq.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setForm({ ...emptyForm(), name: eq.name, category: eq.category || '', model: eq.model || '', serialNumber: eq.serialNumber || '', description: eq.description || '', roomId: eq.room?.id || '', status: eq.status, requiresApproval: eq.requiresApproval, manualUrl: eq.manualUrl || '', imageUrl: eq.imageUrl || '' }); setModal({ open: true, edit: eq }); }} className="text-xs text-primary-600 hover:underline">Edit</button>
                      <button onClick={() => setDeleteId(eq.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal?.open && (
        <Modal title={modal.edit ? 'Edit Equipment' : 'New Equipment'} onClose={() => setModal(null)} size="xl">
          <div className="space-y-4">
            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail Image</label>
              <div
                onClick={() => imgInputRef.current?.click()}
                className="relative border-2 border-dashed border-gray-300 rounded-xl overflow-hidden cursor-pointer hover:border-primary-400 transition-colors"
                style={{ height: '140px' }}
              >
                {form.imageUrl ? (
                  <img src={form.imageUrl.startsWith('/') ? `${API_BASE}${form.imageUrl}` : form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span className="text-sm">{uploadingImg ? 'Uploading…' : 'Click to upload image'}</span>
                  </div>
                )}
                {uploadingImg && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" /></div>}
              </div>
              <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              {[
                { label: 'Category', key: 'category' },
                { label: 'Model', key: 'model' },
                { label: 'Serial Number', key: 'serialNumber' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type="text" value={(form as Record<string, unknown>)[f.key] as string || ''} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="available">Available</option>
                  <option value="in_use">In Use</option>
                  <option value="under_maintenance">Under Maintenance</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Brief description of the equipment, its purpose and capabilities…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            {/* Manual upload */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">User Manual (PDF)</label>
              <div className="flex gap-2">
                <input type="text" value={form.manualUrl} onChange={(e) => setForm((p) => ({ ...p, manualUrl: e.target.value }))} placeholder="Upload or paste URL…" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <button
                  type="button"
                  onClick={() => manualInputRef.current?.click()}
                  className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
                >
                  {uploadingManual ? 'Uploading…' : '📎 Upload'}
                </button>
              </div>
              <input ref={manualInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadManual(f); }} />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="reqApproval" checked={form.requiresApproval} onChange={(e) => setForm((p) => ({ ...p, requiresApproval: e.target.checked }))} className="w-4 h-4 rounded" />
              <label htmlFor="reqApproval" className="text-sm text-gray-700">Requires admin approval to book</label>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.name} className="px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium">
                {saving ? 'Saving…' : modal?.edit ? 'Save Changes' : 'Add Equipment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete Equipment"
          message="This will permanently delete the equipment. Active bookings will block deletion."
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
