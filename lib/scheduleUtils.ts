/**
 * Schedule utility functions for overlap detection, validation, and merging
 */

export interface TimeRange {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export interface DaySchedule {
  dayOfWeek: number;
  timeRange: TimeRange;
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
  const [start1Hours, start1Minutes] = range1.start.split(':').map(Number);
  const [end1Hours, end1Minutes] = range1.end.split(':').map(Number);
  const [start2Hours, start2Minutes] = range2.start.split(':').map(Number);
  const [end2Hours, end2Minutes] = range2.end.split(':').map(Number);

  const start1 = start1Hours * 60 + start1Minutes;
  const end1 = end1Hours * 60 + end1Minutes;
  const start2 = start2Hours * 60 + start2Minutes;
  const end2 = end2Hours * 60 + end2Minutes;

  // Handle case where end time is next day (e.g., 23:00 to 01:00)
  const end1Adjusted = end1 < start1 ? end1 + 24 * 60 : end1;
  const end2Adjusted = end2 < start2 ? end2 + 24 * 60 : end2;
  const start2Adjusted = end1 < start1 && start2 < end1 ? start2 + 24 * 60 : start2;
  const start1Adjusted = end2 < start2 && start1 < end2 ? start1 + 24 * 60 : start1;

  return (
    (start1Adjusted < end2Adjusted && start2Adjusted < end1Adjusted) ||
    (start1Adjusted === start2Adjusted && end1Adjusted === end2Adjusted)
  );
}

/**
 * Check if a schedule overlaps with existing schedules for the same day
 */
export function detectOverlaps(
  newSchedule: DaySchedule,
  existingSchedules: DaySchedule[]
): DaySchedule[] {
  return existingSchedules.filter(
    (existing) =>
      existing.dayOfWeek === newSchedule.dayOfWeek &&
      timeRangesOverlap(existing.timeRange, newSchedule.timeRange)
  );
}

/**
 * Validate a schedule before saving
 */
export function validateSchedule(schedule: DaySchedule): { valid: boolean; error?: string } {
  if (!schedule.timeRange.start || !schedule.timeRange.end) {
    return { valid: false, error: 'Start and end times are required' };
  }

  const [startHours, startMinutes] = schedule.timeRange.start.split(':').map(Number);
  const [endHours, endMinutes] = schedule.timeRange.end.split(':').map(Number);

  if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) {
    return { valid: false, error: 'Invalid time format' };
  }

  if (startHours < 0 || startHours > 23 || startMinutes < 0 || startMinutes > 59) {
    return { valid: false, error: 'Invalid start time' };
  }

  if (endHours < 0 || endHours > 23 || endMinutes < 0 || endMinutes > 59) {
    return { valid: false, error: 'Invalid end time' };
  }

  // Allow end time to be next day (e.g., 23:00 to 01:00)
  const startTotal = startHours * 60 + startMinutes;
  let endTotal = endHours * 60 + endMinutes;
  if (endTotal <= startTotal) {
    endTotal += 24 * 60; // Next day
  }

  // Check if duration is reasonable (not more than 24 hours)
  const duration = endTotal - startTotal;
  if (duration > 24 * 60) {
    return { valid: false, error: 'Schedule duration cannot exceed 24 hours' };
  }

  return { valid: true };
}

/**
 * Merge multiple schedules for the same day
 * Returns the effective time ranges (handles overlaps by taking union)
 */
export function mergeSchedulesForDay(daySchedules: DaySchedule[]): TimeRange[] {
  if (daySchedules.length === 0) return [];

  // Sort by start time
  const sorted = [...daySchedules].sort((a, b) => {
    const [aHours, aMinutes] = a.timeRange.start.split(':').map(Number);
    const [bHours, bMinutes] = b.timeRange.start.split(':').map(Number);
    return aHours * 60 + aMinutes - (bHours * 60 + bMinutes);
  });

  const merged: TimeRange[] = [];
  let current = { ...sorted[0].timeRange };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i].timeRange;

    // Check if current and next overlap or are adjacent
    if (timeRangesOverlap(current, next) || current.end === next.start) {
      // Merge: extend current end time to the later of the two
      const [currentEndHours, currentEndMinutes] = current.end.split(':').map(Number);
      const [nextEndHours, nextEndMinutes] = next.end.split(':').map(Number);
      const currentEndTotal = currentEndHours * 60 + currentEndMinutes;
      const nextEndTotal = nextEndHours * 60 + nextEndMinutes;

      if (nextEndTotal > currentEndTotal) {
        current.end = next.end;
      }
    } else {
      // No overlap: save current and start new
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Check if a date is within a date range
 */
export function isDateInRange(
  date: Date,
  startDate: string | null,
  endDate: string | null
): boolean {
  const dateStr = date.toISOString().split('T')[0];

  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;

  return true;
}

/**
 * Format time range for display
 */
export function formatTimeRange(range: TimeRange): string {
  return `${range.start} - ${range.end}`;
}

/**
 * Convert day of week number to name
 */
export function dayOfWeekToName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
}

/**
 * Convert day of week number to short name
 */
export function dayOfWeekToShortName(dayOfWeek: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayOfWeek] || 'Unknown';
}

