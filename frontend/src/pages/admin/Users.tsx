import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface User {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  employeeId: string | null;
  department: string | null;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
}

const emptyForm = () => ({
  username: '', password: '', fullName: '', email: '',
  phone: '', employeeId: '', department: '', role: 'member', active: true,
});

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: User } | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/api/users').then((r) => setUsers(r.data.data ?? []));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setModal({ open: true });
  };

  const openEdit = (u: User) => {
    setForm({ ...emptyForm(), username: u.username, fullName: u.fullName, email: u.email || '', phone: u.phone || '', employeeId: u.employeeId || '', department: u.department || '', role: u.role, active: u.active, password: '' });
    setModal({ open: true, edit: u });
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal?.edit) {
        await api.put(`/api/users/${modal.edit.id}`, {
          username: form.username, fullName: form.fullName,
          email: form.email || null, phone: form.phone || null,
          employeeId: form.employeeId || null, department: form.department || null,
          role: form.role, active: form.active,
        });
        toast.success('User updated');
      } else {
        await api.post('/api/users', form);
        toast.success('User created');
      }
      setModal(null);
      await load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/api/users/${deleteId}`, { data: { confirm: true } });
      toast.success('User deleted');
      await load();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button onClick={openCreate} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">
          + New User
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Username</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Department</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-600">{u.username}</td>
                <td className="px-4 py-3 text-gray-500">{u.department || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={u.role} /></td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${u.active ? 'text-green-600' : 'text-gray-400'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => navigate(`/admin/member-view/${u.id}`)} className="text-xs text-blue-600 hover:underline">View as</button>
                    <button onClick={() => openEdit(u)} className="text-xs text-primary-600 hover:underline">Edit</button>
                    <button onClick={() => setDeleteId(u.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.open && (
        <Modal title={modal.edit ? 'Edit User' : 'New User'} onClose={() => setModal(null)} size="lg">
          <div className="space-y-3">
            {[
              { label: 'Full Name *', key: 'fullName', type: 'text' },
              { label: 'Username *', key: 'username', type: 'text' },
              ...(!modal.edit ? [{ label: 'Password *', key: 'password', type: 'password' }] : []),
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'Phone', key: 'phone', type: 'tel' },
              { label: 'Employee ID', key: 'employeeId', type: 'text' },
              { label: 'Department', key: 'department', type: 'text' },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={(form as Record<string, unknown>)[f.key] as string || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="professor">Professor</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="active" className="text-sm text-gray-700">Active</label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete User"
          message="This permanently removes the user. Are you sure?"
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
