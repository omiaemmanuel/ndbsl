import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../utils/formatDate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface Booking {
  id: string;
  purpose: string;
  startDatetime: string;
  endDatetime: string;
  status: string;
  equipment: { id: string; name: string };
}

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/bookings').then((r) => setBookings(r.data.data ?? [])).finally(() => setLoading(false));
  }, []);

  const confirmCancel = async () => {
    if (!cancelId) return;
    try {
      await api.put(`/api/bookings/${cancelId}/cancel`);
      setBookings((prev) => prev.map((b) => b.id === cancelId ? { ...b, status: 'cancelled' } : b));
      toast.success('Booking cancelled');
    } catch {
      toast.error('Failed to cancel booking');
    } finally {
      setCancelId(null);
    }
  };

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Bookings</h1>

      {bookings.length === 0 ? (
        <div className="text-gray-500 text-sm">No bookings yet.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Equipment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Purpose</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Start</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">End</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{b.equipment.name}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{b.purpose}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(b.startDatetime)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDateTime(b.endDatetime)}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">
                    {b.status === 'confirmed' && new Date(b.startDatetime) > new Date() && (
                      <button
                        onClick={() => setCancelId(b.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cancelId && (
        <ConfirmDialog
          title="Cancel Booking"
          message="Are you sure you want to cancel this booking?"
          confirmLabel="Yes, Cancel"
          danger
          onConfirm={confirmCancel}
          onCancel={() => setCancelId(null)}
        />
      )}
    </div>
  );
}
