/**
 * Utility functions for converting between minutes and ISO 8601 duration format
 * ISO 8601 format: PT[n]H[n]M[n]S (e.g., PT60M for 60 minutes)
 */

/**
 * Convert minutes to ISO 8601 duration format
 * @param minutes - Number of minutes
 * @returns ISO 8601 duration string (e.g., "PT60M" for 60 minutes)
 */
export function minutesToIso8601(minutes: number): string {
  if (minutes < 0) {
    throw new Error('Minutes must be non-negative');
  }
  
  // For simplicity, we'll use minutes only (PT[n]M format)
  // If we need hours, we could do: hours = Math.floor(minutes / 60), remainingMinutes = minutes % 60
  // But for now, keeping it simple with just minutes
  return `PT${minutes}M`;
}

/**
 * Convert ISO 8601 duration format to minutes
 * @param iso8601 - ISO 8601 duration string (e.g., "PT60M")
 * @returns Number of minutes
 */
export function iso8601ToMinutes(iso8601: string): number {
  // Parse ISO 8601 duration format: PT[n]H[n]M[n]S
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    throw new Error(`Invalid ISO 8601 duration format: ${iso8601}`);
  }
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 60 + minutes + Math.round(seconds / 60);
}

