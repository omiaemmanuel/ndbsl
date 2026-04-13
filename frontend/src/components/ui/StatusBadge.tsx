interface Props {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  // Procurement
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  queried: 'bg-purple-100 text-purple-800',
  declined: 'bg-red-100 text-red-800',
  ordered: 'bg-blue-100 text-blue-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600',
  // Booking
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-600',
  // Equipment
  available: 'bg-green-100 text-green-800',
  in_use: 'bg-blue-100 text-blue-800',
  under_maintenance: 'bg-orange-100 text-orange-800',
  decommissioned: 'bg-gray-100 text-gray-600',
  // Fault
  in_progress: 'bg-orange-100 text-orange-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  // Consumable requests
  issued: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  // Priority
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
  // Stock
  in_stock: 'bg-green-100 text-green-800',
  low_stock: 'bg-yellow-100 text-yellow-800',
  out_of_stock: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: Props) {
  const styles = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
  const label = status.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles}`}>
      {label}
    </span>
  );
}
