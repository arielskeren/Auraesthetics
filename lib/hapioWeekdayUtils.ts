/**
 * Utility functions for converting between internal weekday format (0-6, Sunday-Saturday)
 * and Hapio API's string enum format ("sunday", "monday", "tuesday", etc.)
 */

/**
 * Converts weekday number (0-6, Sunday-Saturday) to Hapio's string enum format
 * @param dayOfWeek - Number from 0 (Sunday) to 6 (Saturday)
 * @returns Hapio weekday string: "sunday", "monday", "tuesday", etc.
 */
export function getHapioWeekdayString(dayOfWeek: number): string {
  const weekdayMap: Record<number, string> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };
  
  const weekday = weekdayMap[dayOfWeek];
  if (!weekday) {
    console.warn(`[hapioWeekdayUtils] Invalid dayOfWeek: ${dayOfWeek}, defaulting to monday`);
    return 'monday';
  }
  
  return weekday;
}

/**
 * Converts Hapio weekday format (string enum or legacy number) back to internal format (0-6)
 * @param hapioWeekday - Hapio weekday as string ("monday", "tuesday", etc.) or legacy number (1-7 or 0-6)
 * @returns Number from 0 (Sunday) to 6 (Saturday)
 */
export function getWeekdayFromHapioString(hapioWeekday: string | number): number {
  // Handle legacy numeric format
  if (typeof hapioWeekday === 'number') {
    // Legacy format: 1-7 where 1=Monday, 7=Sunday
    if (hapioWeekday === 7) return 0; // Sunday
    // Legacy format: 0-6 where 0=Sunday, 6=Saturday (already correct)
    if (hapioWeekday >= 0 && hapioWeekday <= 6) return hapioWeekday;
    // Legacy format: 1-6 where 1=Monday, 6=Saturday
    if (hapioWeekday >= 1 && hapioWeekday <= 6) return hapioWeekday;
    console.warn(`[hapioWeekdayUtils] Invalid numeric weekday: ${hapioWeekday}, defaulting to monday (1)`);
    return 1;
  }
  
  // Handle string enum format
  const weekdayMap: Record<string, number> = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
  };
  
  const dayOfWeek = weekdayMap[hapioWeekday.toLowerCase()];
  if (dayOfWeek === undefined) {
    console.warn(`[hapioWeekdayUtils] Invalid string weekday: ${hapioWeekday}, defaulting to monday (1)`);
    return 1;
  }
  
  return dayOfWeek;
}

