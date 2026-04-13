import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatDate } from '../../utils/formatDate';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface AnnouncementFile {
  id: string;
  filename: string;
  fileUrl: string;
  fileSize?: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  visible: boolean;
  visibleFrom: string;
  visibleUntil: string | null;
  displayOrder: number;
  isArchived: boolean;
  createdAt: string;
  files: AnnouncementFile[];
}

const emptyForm = () => ({
  title: '',
  content: '',
  visibleFrom: new Date().toISOString().split('T')[0],
  visibleUntil: '',
  displayOrder: 0,
  visible: true,
});

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: Announcement } | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // File upload state (for edit modal)
  const [editAnnouncement, setEditAnnouncement] = useState<Announcement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api.get('/api/announcements/all').then((r) => {
      setItems(r.data.data ?? []);
    });

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const openNew = () => {
    setForm(emptyForm());
    setEditAnnouncement(null);
    setModal({ open: true });
  };

  const openEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      content: a.content,
      visibleFrom: a.visibleFrom?.split('T')[0] || '',
      visibleUntil: a.visibleUntil?.split('T')[0] || '',
      displayOrder: a.displayOrder,
      visible: a.visible,
    });
    setEditAnnouncement(a);
    setModal({ open: true, edit: a });
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = { ...form, visibleUntil: form.visibleUntil || null };
      if (modal?.edit) {
        await api.put(`/api/announcements/${modal.edit.id}`, data);
      } else {
        await api.post('/api/announcements', data);
      }
      toast.success('Saved');
      setModal(null);
      setEditAnnouncement(null);
      await load();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editAnnouncement) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/api/announcements/${editAnnouncement.id}/files`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newFile: AnnouncementFile = res.data;
      setEditAnnouncement((prev) => prev ? { ...prev, files: [...prev.files, newFile] } : prev);
      // Update items list
      setItems((prev) =>
        prev.map((a) =>
          a.id === editAnnouncement.id ? { ...a, files: [...a.files, newFile] } : a
        )
      );
      toast.success('File uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!editAnnouncement) return;
    setDeletingFileId(fileId);
    try {
      await api.delete(`/api/announcements/${editAnnouncement.id}/files/${fileId}`);
      setEditAnnouncement((prev) =>
        prev ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) } : prev
      );
      setItems((prev) =>
        prev.map((a) =>
          a.id === editAnnouncement.id
            ? { ...a, files: a.files.filter((f) => f.id !== fileId) }
            : a
        )
      );
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setDeletingFileId(null);
    }
  };

  const archive = async (id: string, isArchived: boolean) => {
    try {
      await api.post(`/api/announcements/${id}/archive`, { unarchive: isArchived });
      toast.success(isArchived ? 'Unarchived' : 'Archived');
      await load();
    } catch {
      toast.error('Failed');
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/api/announcements/${deleteId}`);
      toast.success('Deleted');
      await load();
    } catch {
      toast.error('Failed');
    } finally {
      setDeleteId(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        <button
          onClick={openNew}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
        >
          + New Announcement
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Title', 'Files', 'Visible', 'From', 'Until', 'Order', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((a) => (
              <tr key={a.id} className={`hover:bg-gray-50 ${a.isArchived ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{a.title}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {a.files.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-blue-600">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {a.files.length} file{a.files.length !== 1 ? 's' : ''}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${a.visible ? 'text-green-600' : 'text-gray-400'}`}>
                    {a.visible ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(a.visibleFrom)}</td>
                <td className="px-4 py-3 text-gray-500">{a.visibleUntil ? formatDate(a.visibleUntil) : '—'}</td>
                <td className="px-4 py-3 text-gray-500">{a.displayOrder}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(a)} className="text-xs text-primary-600 hover:underline">Edit</button>
                    <button onClick={() => archive(a.id, a.isArchived)} className="text-xs text-gray-500 hover:underline">
                      {a.isArchived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button onClick={() => setDeleteId(a.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.open && (
        <Modal
          title={modal.edit ? 'Edit Announcement' : 'New Announcement'}
          onClose={() => { setModal(null); setEditAnnouncement(null); }}
          size="xl"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                rows={5}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visible From</label>
                <input
                  type="date"
                  value={form.visibleFrom}
                  onChange={(e) => setForm((p) => ({ ...p, visibleFrom: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visible Until (optional)</label>
                <input
                  type="date"
                  value={form.visibleUntil}
                  onChange={(e) => setForm((p) => ({ ...p, visibleUntil: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) => setForm((p) => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.visible}
                    onChange={(e) => setForm((p) => ({ ...p, visible: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Visible on Home Page</span>
                </label>
              </div>
            </div>

            {/* File attachments — only for saved announcements */}
            {modal.edit && editAnnouncement ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Attachments</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {uploading ? 'Uploading…' : 'Upload File'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                {editAnnouncement.files.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">No files attached. Upload PDF, PNG, JPG, or DOCX (max 20 MB).</p>
                ) : (
                  <ul className="space-y-1.5">
                    {editAnnouncement.files.map((f) => {
                      const src = f.fileUrl.startsWith('/') ? `${API_BASE}${f.fileUrl}` : f.fileUrl;
                      return (
                        <li key={f.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <a
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={f.filename}
                            className="flex-1 text-sm text-blue-600 hover:underline truncate"
                          >
                            {f.filename}
                          </a>
                          {f.fileSize && (
                            <span className="text-xs text-gray-400">{formatFileSize(f.fileSize)}</span>
                          )}
                          <button
                            onClick={() => deleteFile(f.id)}
                            disabled={deletingFileId === f.id}
                            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletingFileId === f.id ? '…' : 'Remove'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : !modal.edit ? (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                Save the announcement first, then re-open it to attach files.
              </p>
            ) : null}

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => { setModal(null); setEditAnnouncement(null); }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete Announcement"
          message="Delete this announcement and all its attached files? This is permanent."
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
