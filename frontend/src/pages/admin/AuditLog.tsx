import { useEffect, useState } from 'react';
import api from '../../hooks/useApi';
import { formatDateTime } from '../../utils/formatDate';

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  note: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { fullName: string; username: string } | null;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ resourceType: '', from: '', to: '' });

  const load = () => {
    const params = new URLSearchParams();
    if (filters.resourceType) params.set('resourceType', filters.resourceType);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    return api.get(`/api/audit?${params}`).then((r) => setLogs(r.data.data ?? []));
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const exportCsv = () => {
    const header = 'Timestamp,User,Action,Resource Type,Resource ID,Note\n';
    const rows = logs.map((l) =>
      `"${formatDateTime(l.createdAt)}","${l.user?.fullName || ''}","${l.action}","${l.resourceType || ''}","${l.resourceId || ''}","${l.note || ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <button onClick={exportCsv} className="text-sm text-primary-600 border border-primary-300 px-3 py-1.5 rounded hover:bg-primary-50">
          Export CSV
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Resource type…"
          value={filters.resourceType}
          onChange={(e) => setFilters((p) => ({ ...p, resourceType: e.target.value }))}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40"
        />
        <input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
        <input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
        <button onClick={() => load()} className="px-4 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-900">
          Apply
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading…</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Timestamp', 'User', 'Action', 'Resource', 'Note'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-700">{l.user?.fullName || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{l.action}</td>
                  <td className="px-4 py-3 text-gray-500">{l.resourceType}{l.resourceId ? ` / ${l.resourceId.slice(0, 8)}…` : ''}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{l.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
