export const EST_TIMEZONE = 'America/New_York';

export function formatInEST(dateLike: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateLike) return 'N/A';
  const date = typeof dateLike === 'string' || typeof dateLike === 'number' ? new Date(dateLike) : dateLike;
  if (Number.isNaN(date.getTime())) return 'N/A';
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  });
  return fmt.format(date);
}


