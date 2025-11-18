/**
 * Utility functions for formatting dates in Hapio API format
 * Hapio requires: Y-m-d\TH:i:sP (e.g., 2025-11-01T04:00:00+00:00)
 */

/**
 * Format a Date object to Hapio's required format: Y-m-d\TH:i:sP
 * Example: 2025-11-18T14:30:00-05:00
 * 
 * This function formats the date in the local timezone (preserving the time as entered)
 * and includes the timezone offset.
 */
export function formatDateForHapio(date: Date): string {
  // Use local time components (not UTC) to preserve the timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  
  // Get timezone offset in +HH:MM format
  // getTimezoneOffset() returns offset in minutes from UTC
  // For EST (UTC-5): returns 300 (positive, meaning 300 minutes behind UTC)
  // For EDT (UTC-4): returns 240 (positive, meaning 240 minutes behind UTC)
  // To represent as -05:00 for EST, we need to use negative sign when offset > 0
  const offset = date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  // If offset is positive (behind UTC), use negative sign (e.g., EST: 300 minutes = -05:00)
  // If offset is negative (ahead of UTC), use positive sign (rare, but possible)
  const offsetSign = offset > 0 ? '-' : '+';
  const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetString}`;
}

/**
 * Format a Date object to Hapio's required format for UTC (always +00:00)
 * Example: 2025-11-01T04:00:00+00:00
 */
export function formatDateForHapioUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+00:00`;
}

