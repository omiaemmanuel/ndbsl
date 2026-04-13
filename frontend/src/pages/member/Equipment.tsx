import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../hooks/useApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ViewToggle } from '../../components/ui/ViewToggle';
import { BookingCalendar } from '../../components/calendar/BookingCalendar';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ActiveFault {
  id: string;
  severity: string;
  status: string;
  description: string;
  createdAt: string;
}

interface Equipment {
  id: string;
  name: string;
  category: string | null;
  model: string | null;
  serialNumber: string | null;
  description: string | null;
  status: 'available' | 'in_use' | 'under_maintenance' | 'decommissioned';
  manualUrl: string | null;
  imageUrl: string | null;
  requiresApproval: boolean;
  bookingDisabled: boolean;
  room: { id: string; name: string; parent?: { name: string } | null } | null;
  faultReports: ActiveFault[];
}

interface BookedRange {
  start: Date;
  end: Date;
  bookerName: string;
}

type DetailTab = 'info' | 'book';

export default function MemberEquipment() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [detailEq, setDetailEq] = useState<Equipment | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null);
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  useEffect(() => {
    api.get('/api/equipment')
      .then((r) => setEquipment(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const categories = ['all', ...Array.from(new Set(equipment.map((e) => e.category).filter(Boolean) as string[]))];

  const filtered = equipment.filter((eq) => {
    const matchSearch = !search || eq.name.toLowerCase().includes(search.toLowerCase()) ||
      (eq.category ?? '').toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || eq.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || eq.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const openDetail = async (eq: Equipment) => {
    setDetailEq(eq);
    setDetailTab('info');
    setSelectedStart(null);
    setSelectedEnd(null);
    setPurpose('');
    setLoadingBookings(true);
    try {
      const r = await api.get(`/api/equipment/${eq.id}/bookings`);
      const ranges: BookedRange[] = (r.data.data ?? [])
        .filter((b: { status: string }) => b.status === 'confirmed')
        .map((b: { startDatetime: string; endDatetime: string; user: { fullName: string } }) => ({
          start: new Date(b.startDatetime),
          end: new Date(b.endDatetime),
          bookerName: b.user?.fullName ?? 'Someone',
        }));
      setBookedRanges(ranges);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleRangeSelect = (start: Date, end?: Date) => {
    setSelectedStart(start);
    setSelectedEnd(end ?? null);
  };

  const submitBooking = async () => {
    if (!detailEq || !selectedStart || !purpose.trim()) {
      toast.error('Please select dates and fill in purpose');
      return;
    }
    const end = selectedEnd ?? selectedStart;
    const startDt = new Date(selectedStart); startDt.setHours(9, 0, 0, 0);
    const endDt = new Date(end); endDt.setHours(17, 0, 0, 0);

    setSubmitting(true);
    try {
      const res = await api.post('/api/bookings', {
        equipmentId: detailEq.id,
        purpose,
        startDatetime: startDt.toISOString(),
        endDatetime: endDt.toISOString(),
      });
      const requiresApproval = (res.data as { requiresApproval?: boolean })?.requiresApproval;
      if (requiresApproval) {
        toast.success('Booking request submitted — awaiting admin approval');
      } else {
        toast.success('Booking confirmed!');
      }
      setDetailEq(null);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s: string) => ({
    available: 'bg-green-500',
    in_use: 'bg-blue-500',
    under_maintenance: 'bg-orange-500',
    decommissioned: 'bg-gray-400',
  }[s] ?? 'bg-gray-400');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipment</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} items</p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search equipment…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="in_use">In Use</option>
          <option value="under_maintenance">Under Maintenance</option>
        </select>
      </div>

      {/* Grid View */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((eq) => (
            <div
              key={eq.id}
              onClick={() => openDetail(eq)}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group"
            >
              {/* Thumbnail */}
              <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                {eq.imageUrl ? (
                  <img
                    src={eq.imageUrl.startsWith('/') ? `${API_BASE}${eq.imageUrl}` : eq.imageUrl}
                    alt={eq.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                  </div>
                )}
                {/* Status dot */}
                <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white shadow ${statusColor(eq.status)}`} />
                {/* Fault indicator */}
                {eq.faultReports.length > 0 && (
                  <div className="absolute top-2 left-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                      eq.bookingDisabled ? 'bg-red-600 text-white border-red-700' :
                      eq.faultReports[0].severity === 'critical' ? 'bg-red-100 text-red-700 border-red-300' :
                      eq.faultReports[0].severity === 'high' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                      'bg-yellow-100 text-yellow-700 border-yellow-300'
                    }`}>
                      {eq.bookingDisabled ? 'Disabled' : '⚠ Fault'}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">{eq.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{eq.category || '—'}</span>
                  <StatusBadge status={eq.status} />
                </div>
                {eq.room && (
                  <p className="text-xs text-gray-400 mt-1.5 truncate">
                    📍 {eq.room.parent ? `${eq.room.parent.name} › ` : ''}{eq.room.name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.map((eq, idx) => (
            <div
              key={eq.id}
              onClick={() => openDetail(eq)}
              className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${idx > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {eq.imageUrl ? (
                  <img src={eq.imageUrl.startsWith('/') ? `${API_BASE}${eq.imageUrl}` : eq.imageUrl} alt={eq.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{eq.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{eq.category} {eq.room ? `· ${eq.room.name}` : ''}</p>
                {eq.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{eq.description}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {eq.faultReports.length > 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    eq.bookingDisabled ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'
                  }`}>
                    {eq.bookingDisabled ? '⛔ Disabled' : '⚠ Fault'}
                  </span>
                )}
                <StatusBadge status={eq.status} />
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-sm">No equipment found</p>
        </div>
      )}

      {/* Detail modal */}
      {detailEq && (
        <Modal title={detailEq.name} onClose={() => setDetailEq(null)} size="xl">
          {/* Tabs */}
          <div className="flex gap-1 mb-5 border-b border-gray-200 -mt-1">
            {(['info', 'book'] as DetailTab[]).map((t) => {
              const bookingBlocked = t === 'book' && (detailEq.bookingDisabled || ['under_maintenance', 'decommissioned'].includes(detailEq.status));
              return (
              <button
                key={t}
                onClick={() => !bookingBlocked && setDetailTab(t)}
                disabled={bookingBlocked}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === t
                    ? 'border-primary-600 text-primary-600'
                    : bookingBlocked
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'info' ? 'Details' : detailEq.bookingDisabled ? 'Booking Disabled' : 'Book Equipment'}
              </button>
              );
            })}
          </div>

          {detailTab === 'info' && (
            <div className="space-y-5">
              {/* Image */}
              {detailEq.imageUrl && (
                <div className="rounded-xl overflow-hidden h-52 bg-gray-100">
                  <img
                    src={detailEq.imageUrl.startsWith('/') ? `${API_BASE}${detailEq.imageUrl}` : detailEq.imageUrl}
                    alt={detailEq.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Status + info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Status', value: <StatusBadge status={detailEq.status} /> },
                  { label: 'Category', value: detailEq.category },
                  { label: 'Model', value: detailEq.model },
                  { label: 'Serial No.', value: detailEq.serialNumber },
                  { label: 'Location', value: detailEq.room ? `${detailEq.room.parent ? detailEq.room.parent.name + ' › ' : ''}${detailEq.room.name}` : null },
                ].filter(f => f.value).map((f) => (
                  <div key={f.label} className="bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-xs text-gray-400 mb-0.5">{f.label}</p>
                    <div className="text-sm font-medium text-gray-800">{f.value}</div>
                  </div>
                ))}
              </div>

              {detailEq.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{detailEq.description}</p>
                </div>
              )}

              {/* Resources */}
              <div className="flex flex-wrap gap-2">
                {detailEq.manualUrl && (
                  <a
                    href={detailEq.manualUrl.startsWith('/') ? `${API_BASE}${detailEq.manualUrl}` : detailEq.manualUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Download Manual
                  </a>
                )}
              </div>

              {/* Active fault banners */}
              {detailEq.faultReports.length > 0 && (
                <div className="space-y-2">
                  {detailEq.faultReports.map((f) => (
                    <div key={f.id} className={`rounded-lg border px-4 py-3 text-xs ${
                      f.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
                      f.severity === 'high'     ? 'bg-orange-50 border-orange-200 text-orange-800' :
                      f.severity === 'medium'   ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                                  'bg-blue-50 border-blue-200 text-blue-800'
                    }`}>
                      <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide mb-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        {f.severity} fault — {f.status.replace('_', ' ')}
                      </div>
                      <p className="leading-relaxed">{f.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {detailEq.bookingDisabled ? (
                <div className="w-full bg-red-50 border border-red-200 text-red-700 py-2.5 rounded-lg text-center text-sm font-medium">
                  Bookings currently disabled — fault under review
                </div>
              ) : !['under_maintenance', 'decommissioned'].includes(detailEq.status) && (
                <button
                  onClick={() => setDetailTab('book')}
                  className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  {detailEq.status === 'in_use' ? 'Book for Later →' : 'Book Now →'}
                </button>
              )}
            </div>
          )}

          {detailTab === 'book' && (
            <div>
              {loadingBookings ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : (
                <div className="space-y-5">
                  <BookingCalendar
                    bookedRanges={bookedRanges}
                    onRangeSelect={handleRangeSelect}
                    selectedStart={selectedStart}
                    selectedEnd={selectedEnd}
                  />

                  {selectedStart && (
                    <div className="bg-primary-50 border border-primary-100 rounded-lg px-4 py-3 text-sm text-primary-700">
                      <span className="font-medium">Selected: </span>
                      {selectedStart.toLocaleDateString('en-CA')}
                      {selectedEnd && !isSameDate(selectedStart, selectedEnd) && ` → ${selectedEnd.toLocaleDateString('en-CA')}`}
                      <span className="text-primary-500 ml-2">(9:00 AM – 5:00 PM)</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Purpose <span className="text-red-500">*</span></label>
                    <textarea
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      rows={3}
                      placeholder="Describe your intended use…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <button
                    onClick={submitBooking}
                    disabled={submitting || !selectedStart || !purpose.trim()}
                    className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Booking…' : 'Confirm Booking'}
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
