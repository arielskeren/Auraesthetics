/**
 * Utility functions for formatting dates in Hapio API format
 * Hapio requires: Y-m-d\TH:i:sP (e.g., 2025-11-01T14:30:00-05:00)
 * All dates are formatted in EST timezone
 */

import { EST_TIMEZONE } from './timezone';

/**
 * Format a Date object to Hapio's required format: Y-m-d\TH:i:sP
 * Example: 2025-11-18T14:30:00-05:00 (EST) or 2025-07-18T14:30:00-04:00 (EDT)
 * 
 * This function ALWAYS formats the date in EST/EDT timezone with correct offset.
 */
export function formatDateForHapio(date: Date): string {
  try {
    // Use Intl.DateTimeFormat to get EST time components
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: EST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    const parts = fmt.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');

    // Derive offset by comparing the same wall time vs UTC
    // Approach: get the clock components in EST and UTC, then compute offset
    const utc = {
      y: date.getUTCFullYear(),
      m: date.getUTCMonth(),
      d: date.getUTCDate(),
      hh: date.getUTCHours(),
      mm: date.getUTCMinutes(),
      ss: date.getUTCSeconds(),
    };
    
    // Build a Date from the EST parts interpreted as if they were UTC, then diff
    const pseudoUtc = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ));
    
    // Offset minutes = (pseudoUtc - actualUTC)
    const diffMs = pseudoUtc.getTime() - Date.UTC(utc.y, utc.m, utc.d, utc.hh, utc.mm, utc.ss);
    const offsetMinutes = Math.round(diffMs / 60000);
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const offH = String(Math.floor(abs / 60)).padStart(2, '0');
    const offM = String(abs % 60).padStart(2, '0');
    const offset = `${sign}${offH}:${offM}`;

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
  } catch {
    // Fallback to UTC if any error occurs
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}+00:00`;
  }
}

/**
 * Format a Date object to Hapio's required format for UTC (always +00:00)
 * Example: 2025-11-01T04:00:00+00:00
 * 
 * @deprecated Use formatDateForHapio() instead, which formats in EST timezone.
 * This function is kept for backward compatibility but should not be used for new code.
 */
export function formatDateForHapioUTC(date: Date): string {
  // For backward compatibility, format in UTC
  // But note: all new code should use formatDateForHapio() which uses EST
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+00:00`;
}

