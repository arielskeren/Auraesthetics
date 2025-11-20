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

/**
 * Parse date and time strings as EST timezone
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Time string in HH:MM or HH:MM:SS format
 * @returns Date object representing that EST moment (stored as UTC internally)
 */
export function parseESTDateTime(dateStr: string, timeStr: string): Date {
  // Normalize time string (ensure it has seconds)
  const normalizedTime = timeStr.split(':').length === 2 
    ? `${timeStr}:00`
    : timeStr;
  
  // Parse date and time components
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute, second] = normalizedTime.split(':').map(Number);
  
  // Determine if DST applies at this date
  // DST starts second Sunday of March, ends first Sunday of November
  const isDST = isDateInDST(year, month - 1, day, hour); // month is 0-indexed
  
  // EST is UTC-5, EDT is UTC-4
  const offsetHours = isDST ? 4 : 5;
  
  // Create UTC date by subtracting the EST/EDT offset
  // If it's 2:30 PM EST (UTC-5), that's 7:30 PM UTC
  // If it's 2:30 PM EDT (UTC-4), that's 6:30 PM UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour - offsetHours, minute, second || 0));
  
  return utcDate;
}

/**
 * Check if a date/time falls within DST period in EST
 * DST starts at 2 AM EST on second Sunday of March
 * DST ends at 2 AM EST (1 AM EDT) on first Sunday of November
 */
function isDateInDST(year: number, month: number, day: number, hour: number): boolean {
  // Months 3-10 (April-October) are definitely in DST
  if (month > 2 && month < 10) {
    return true;
  }
  
  // Months 0-1 (January-February) are definitely EST
  if (month < 2) {
    return false;
  }
  
  // Month 2 (March) - check if after second Sunday
  if (month === 2) {
    const dstStart = getDSTStartDate(year);
    const checkDate = new Date(Date.UTC(year, month, day, hour, 0, 0));
    // DST starts at 2 AM EST on second Sunday of March
    return checkDate >= dstStart;
  }
  
  // Month 10 (November) - check if before first Sunday
  if (month === 10) {
    const dstEnd = getDSTEndDate(year);
    const checkDate = new Date(Date.UTC(year, month, day, hour, 0, 0));
    // DST ends at 2 AM EDT (1 AM EST) on first Sunday of November
    return checkDate < dstEnd;
  }
  
  // Month 11 (December) is EST
  return false;
}

/**
 * Helper to get DST start date (second Sunday of March at 2 AM EST) for a given year
 * Returns UTC date representing when DST starts (7 AM UTC = 2 AM EST)
 */
function getDSTStartDate(year: number): Date {
  const march1 = new Date(Date.UTC(year, 2, 1));
  const dayOfWeek = march1.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Day of month for first Sunday
  const secondSunday = firstSunday + 7;
  // DST starts at 2 AM EST, which is 7 AM UTC (EST is UTC-5)
  return new Date(Date.UTC(year, 2, secondSunday, 7, 0, 0));
}

/**
 * Helper to get DST end date (first Sunday of November at 2 AM EDT = 1 AM EST) for a given year
 * Returns UTC date representing when DST ends (6 AM UTC = 2 AM EDT = 1 AM EST)
 */
function getDSTEndDate(year: number): Date {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const dayOfWeek = nov1.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Day of month for first Sunday
  // DST ends at 2 AM EDT (which is 1 AM EST), which is 6 AM UTC (EDT is UTC-4, EST is UTC-5)
  return new Date(Date.UTC(year, 10, firstSunday, 6, 0, 0));
}

/**
 * Get current time in EST context
 * @returns Date object representing current time (will be compared in EST context)
 */
export function getCurrentTimeEST(): Date {
  return new Date();
}

/**
 * Check if a date is in the past, considering EST timezone
 * @param date - Date to check
 * @returns true if the date is in the past when considered in EST timezone
 */
export function isPastDateEST(date: Date): boolean {
  const now = new Date();
  
  // Get EST representation of both dates
  const dateEST = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  
  const nowEST = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  
  // Compare EST components
  const dateStr = `${dateEST.find(p => p.type === 'year')?.value}-${dateEST.find(p => p.type === 'month')?.value}-${dateEST.find(p => p.type === 'day')?.value} ${dateEST.find(p => p.type === 'hour')?.value}:${dateEST.find(p => p.type === 'minute')?.value}:${dateEST.find(p => p.type === 'second')?.value}`;
  const nowStr = `${nowEST.find(p => p.type === 'year')?.value}-${nowEST.find(p => p.type === 'month')?.value}-${nowEST.find(p => p.type === 'day')?.value} ${nowEST.find(p => p.type === 'hour')?.value}:${nowEST.find(p => p.type === 'minute')?.value}:${nowEST.find(p => p.type === 'second')?.value}`;
  
  return dateStr < nowStr;
}

/**
 * Calculate hours until a date, considering EST timezone
 * @param date - Future date
 * @returns Number of hours until the date (in EST context)
 */
export function hoursUntilEST(date: Date): number {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return diffMs / (1000 * 60 * 60);
}


