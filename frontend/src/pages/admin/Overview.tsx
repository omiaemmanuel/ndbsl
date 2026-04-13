import { useEffect, useState } from 'react';
import api from '../../hooks/useApi';
import { formatCurrency } from '../../utils/formatCurrency';

interface OverviewStats {
  pendingRequests: number;
  activeBookings: number;
  openFaults: number;
  lowStockConsumables: number;
  equipmentUnderMaintenance: number;
  monthlySpend: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<OverviewStats>({
    pendingRequests: 0, activeBookings: 0, openFaults: 0,
    lowStockConsumables: 0, equipmentUnderMaintenance: 0, monthlySpend: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();

    Promise.all([
      api.get('/api/procurement?status=pending'),
      api.get('/api/bookings?status=confirmed'),
      api.get('/api/faults?status=pending'),
      api.get('/api/consumables'),
      api.get('/api/equipment'),
      api.get(`/api/expenditure?year=${year}`),
    ]).then(([proc, book, faults, cons, equip, expend]) => {
      const currentMonth = now.getMonth() + 1;
      const monthData = expend.data.monthlyTotals?.find((m: { month: number }) => m.month === currentMonth);

      setStats({
        pendingRequests: proc.data.total ?? 0,
        activeBookings: book.data.total ?? 0,
        openFaults: faults.data.total ?? 0,
        lowStockConsumables: (cons.data.data ?? []).filter((c: { stockStatus: string }) =>
          c.stockStatus === 'low_stock' || c.stockStatus === 'out_of_stock'
        ).length,
        equipmentUnderMaintenance: (equip.data.data ?? []).filter(
          (e: { status: string }) => e.status === 'under_maintenance'
        ).length,
        monthlySpend: monthData?.total ?? 0,
      });
    }).finally(() => setLoading(false));
  }, []);

  const widgets = [
    { label: 'Pending Requests', value: stats.pendingRequests, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
    { label: 'Active Bookings', value: stats.activeBookings, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    { label: 'Open Fault Reports', value: stats.openFaults, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    { label: 'Low Stock Items', value: stats.lowStockConsumables, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    { label: 'Under Maintenance', value: stats.equipmentUnderMaintenance, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
    { label: 'Monthly Spend', value: formatCurrency(stats.monthlySpend), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  ];

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Overview</h1>
      <p className="text-sm text-gray-500 mb-8">NBSL Laboratory Management System</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {widgets.map((w) => (
          <div key={w.label} className={`rounded-lg border p-5 ${w.bg}`}>
            <p className={`text-3xl font-bold ${w.color}`}>{w.value}</p>
            <p className="text-sm text-gray-600 mt-1">{w.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
