import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface Member {
  id: string;
  user: { id: string; fullName: string; username: string; role: string };
}

interface ResearchProject {
  id: string; title: string; researchType: string; summary: string | null;
  description: string | null; leadResearcher: string | null; year: number | null;
  imageUrl: string | null; externalLink: string | null;
  displayOrder: number; status: string;
  members: Member[];
}

interface SystemUser {
  id: string; fullName: string; username: string; department: string | null;
}

const emptyForm = () => ({
  title: '', researchType: 'current' as 'current' | 'completed',
  summary: '', description: '', leadResearcher: '', year: new Date().getFullYear(),
  imageUrl: '', externalLink: '', displayOrder: 0,
  memberIds: [] as string[],
});

export default function ResearchProjects() {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: ResearchProject } | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/api/research').then((r) => setProjects(r.data.data ?? []));

  useEffect(() => {
    Promise.all([
      load(),
      api.get('/api/research/members').then((r) => setSystemUsers(r.data.data ?? [])),
    ]).finally(() => setLoading(false));
  }, []);

  const openNew = () => { setForm(emptyForm()); setModal({ open: true }); };
  const openEdit = (p: ResearchProject) => {
    setForm({
      title: p.title,
      researchType: p.researchType as 'current' | 'completed',
      summary: p.summary || '',
      description: p.description || '',
      leadResearcher: p.leadResearcher || '',
      year: p.year ?? new Date().getFullYear(),
      imageUrl: p.imageUrl || '',
      externalLink: p.externalLink || '',
      displayOrder: p.displayOrder,
      memberIds: p.members.map((m) => m.user.id),
    });
    setModal({ open: true, edit: p });
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = {
        ...form,
        summary: form.summary || null,
        description: form.description || null,
        leadResearcher: form.leadResearcher || null,
        imageUrl: form.imageUrl || null,
        externalLink: form.externalLink || null,
      };
      if (modal?.edit) {
        await api.put(`/api/research/${modal.edit.id}`, data);
      } else {
        await api.post('/api/research', data);
      }
      toast.success('Saved');
      setModal(null);
      await load();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try { await api.delete(`/api/research/${deleteId}`); toast.success('Deleted'); await load(); }
    catch { toast.error('Failed'); }
    finally { setDeleteId(null); }
  };

  const toggleMember = (uid: string) => {
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(uid)
        ? f.memberIds.filter((id) => id !== uid)
        : [...f.memberIds, uid],
    }));
  };

  const current = projects.filter((p) => p.researchType === 'current');
  const completed = projects.filter((p) => p.researchType === 'completed');

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  const ProjectList = ({ items }: { items: ResearchProject[] }) => (
    <div className="space-y-2 mb-8">
      {items.length === 0 && <p className="text-sm text-gray-400">None yet.</p>}
      {items.map((p) => (
        <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{p.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{p.leadResearcher ?? '—'} · {p.year ?? '—'} · Order: {p.displayOrder}</p>
              {p.members.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.members.map((m) => (
                    <span key={m.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">
                      {m.user.fullName}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(p)} className="text-xs text-primary-600 hover:underline px-2 py-1 rounded hover:bg-primary-50">Edit</button>
              <button onClick={() => setDeleteId(p.id)} className="text-xs text-red-600 hover:underline px-2 py-1 rounded hover:bg-red-50">Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Research Projects</h1>
        <button onClick={openNew} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 font-medium">
          + New Project
        </button>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-3">Current Research</h2>
      <ProjectList items={current} />

      <h2 className="text-lg font-semibold text-gray-800 mb-3">Completed Research</h2>
      <ProjectList items={completed} />

      {modal?.open && (
        <Modal title={modal.edit ? 'Edit Project' : 'New Project'} onClose={() => setModal(null)} size="lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.researchType} onChange={(e) => setForm((p) => ({ ...p, researchType: e.target.value as 'current' | 'completed' }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="current">Current</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Short Summary <span className="text-gray-400 font-normal">(shown on cards)</span></label>
              <textarea value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Description <span className="text-gray-400 font-normal">(shown in popup)</span></label>
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={5} placeholder="Detailed description of the project, methodology, goals..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead Researcher</label>
                <input type="text" value={form.leadResearcher} onChange={(e) => setForm((p) => ({ ...p, leadResearcher: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">External Link <span className="text-gray-400 font-normal">(publication URL)</span></label>
              <input type="text" value={form.externalLink} onChange={(e) => setForm((p) => ({ ...p, externalLink: e.target.value }))}
                placeholder="https://doi.org/..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input type="text" value={form.imageUrl} onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input type="number" value={form.displayOrder} onChange={(e) => setForm((p) => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            {/* Student tagging */}
            {systemUsers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tag Students <span className="text-gray-400 font-normal">(gives them edit rights for this project)</span>
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {systemUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.memberIds.includes(u.id)}
                        onChange={() => toggleMember(u.id)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-800">{u.fullName}</span>
                        <span className="text-xs text-gray-400 ml-2">@{u.username}</span>
                        {u.department && <span className="text-xs text-gray-400 ml-2">· {u.department}</span>}
                      </div>
                    </label>
                  ))}
                </div>
                {form.memberIds.length > 0 && (
                  <p className="text-xs text-primary-600 mt-1">{form.memberIds.length} student{form.memberIds.length !== 1 ? 's' : ''} tagged</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Cancel</button>
              <button onClick={save} disabled={saving || !form.title} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md disabled:opacity-50 hover:bg-primary-700">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog title="Delete Project" message="Delete this research project?" confirmLabel="Delete" danger onConfirm={doDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}
