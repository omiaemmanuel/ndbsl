const KST_TIMEZONE = 'Asia/Seoul';

/**
 * Format a date string or Date object in KST timezone
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString('en-US', {
    timeZone: KST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    timeZone: KST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateOnly(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-CA', {
    timeZone: KST_TIMEZONE,
  });
}

/**
 * Check if an announcement is "new" (created within 3 days)
 */
export function isNew(createdAt: string | Date): boolean {
  const diffDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 3;
}
