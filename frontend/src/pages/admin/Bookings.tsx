import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../utils/formatDate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

const STATUS_TABS = ['all', 'pending', 'confirmed', 'completed', 'cancelled', 'archived'];

interface Booking {
  id: string;
  purpose: string;
  startDatetime: string;
  endDatetime: string;
  status: string;
  adminNotes: string | null;
  isArchived: boolean;
  equipment: { name: string };
  user: { fullName: string };
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = () => {
    const params = tab === 'archived' ? '?archived=true' : tab !== 'all' ? `?status=${tab}` : '';
    return api.get(`/api/bookings${params}`).then((r) => setBookings(r.data.data ?? []));
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [tab]);

  const doCancel = async () => {
    if (!cancelId) return;
    try {
      await api.put(`/api/bookings/${cancelId}/cancel`);
      toast.success('Booking cancelled');
      await load();
    } catch { toast.error('Failed'); }
    finally { setCancelId(null); }
  };

  const approve = async (id: string) => {
    setActing(id);
    try {
      await api.put(`/api/bookings/${id}/approve`);
      toast.success('Booking approved');
      await load();
    } catch { toast.error('Failed to approve'); }
    finally { setActing(null); }
  };

  const reject = async (id: string) => {
    setActing(id);
    try {
      await api.put(`/api/bookings/${id}/reject`);
      toast.success('Booking rejected');
      await load();
    } catch { toast.error('Failed to reject'); }
    finally { setActing(null); }
  };

  const archive = async (id: string, isArchived: boolean) => {
    try {
      await api.post(`/api/bookings/${id}/archive`, { unarchive: isArchived });
      toast.success(isArchived ? 'Unarchived' : 'Archived');
      await load();
    } catch { toast.error('Failed'); }
  };

  const pendingCount = bookings.filter(b => b.status === 'pending').length;

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        {tab === 'all' && pendingCount > 0 && (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-1 rounded-full">
            {pendingCount} pending approval
          </span>
        )}
      </div>

      <div className="flex gap-1 flex-wrap mb-4">
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors relative ${tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'pending' && tab !== 'pending' && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No bookings found</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Equipment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Purpose</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Start</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">End</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <tr key={b.id} className={`hover:bg-gray-50 ${b.status === 'pending' ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{b.equipment.name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.user.fullName}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{b.purpose}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(b.startDatetime)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(b.endDatetime)}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end items-center">
                      {b.status === 'pending' && (
                        <>
                          <button
                            onClick={() => approve(b.id)}
                            disabled={acting === b.id}
                            className="text-xs text-green-600 font-medium hover:underline disabled:opacity-50"
                          >Approve</button>
                          <button
                            onClick={() => reject(b.id)}
                            disabled={acting === b.id}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >Reject</button>
                        </>
                      )}
                      {b.status === 'confirmed' && (
                        <button onClick={() => setCancelId(b.id)} className="text-xs text-red-600 hover:underline">Cancel</button>
                      )}
                      {!b.isArchived && (
                        <button onClick={() => archive(b.id, b.isArchived)} className="text-xs text-gray-400 hover:underline">Archive</button>
                      )}
                      {b.isArchived && (
                        <button onClick={() => archive(b.id, b.isArchived)} className="text-xs text-gray-400 hover:underline">Unarchive</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cancelId && (
        <ConfirmDialog title="Cancel Booking" message="Cancel this booking?" confirmLabel="Cancel Booking" danger onConfirm={doCancel} onCancel={() => setCancelId(null)} />
      )}
    </div>
  );
}
