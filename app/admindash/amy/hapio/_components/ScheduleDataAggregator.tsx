'use client';

/**
 * Utility hook to fetch, merge, and calculate effective schedules
 */

export interface EffectiveScheduleSlot {
  date: Date;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  serviceIds: string[];
  type: 'normal' | 'blocked' | 'exception';
}

export interface UseScheduleDataOptions {
  resourceId: string;
  from: Date;
  to: Date;
}

export async function fetchScheduleData(
  resourceId: string,
  from: Date,
  to: Date
): Promise<{
  recurringSchedules: any[];
  recurringScheduleBlocks: any[];
  scheduleBlocks: any[];
}> {
  // Format dates in Hapio format: Y-m-d\TH:i:sP
  const { formatDateForHapioUTC } = await import('@/lib/hapioDateUtils');
  const fromFormatted = formatDateForHapioUTC(from);
  const toFormatted = formatDateForHapioUTC(to);

  const [recurringSchedulesRes, recurringBlocksRes, scheduleBlocksRes] = await Promise.all([
    fetch(`/api/admin/hapio/resources/${resourceId}/recurring-schedules?per_page=100`),
    fetch(`/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks?per_page=100`),
    fetch(`/api/admin/hapio/resources/${resourceId}/schedule-blocks?from=${encodeURIComponent(fromFormatted)}&to=${encodeURIComponent(toFormatted)}&per_page=100`),
  ]);

  const recurringSchedules = recurringSchedulesRes.ok
    ? (await recurringSchedulesRes.json()).data || []
    : [];
  const recurringScheduleBlocks = recurringBlocksRes.ok
    ? (await recurringBlocksRes.json()).data || []
    : [];
  const scheduleBlocks = scheduleBlocksRes.ok
    ? (await scheduleBlocksRes.json()).data || []
    : [];

  return {
    recurringSchedules,
    recurringScheduleBlocks,
    scheduleBlocks,
  };
}

/**
 * Calculate effective schedule slots for a date range
 */
export function calculateEffectiveSchedule(
  from: Date,
  to: Date,
  recurringSchedules: any[],
  recurringScheduleBlocks: any[],
  scheduleBlocks: any[]
): EffectiveScheduleSlot[] {
  const slots: EffectiveScheduleSlot[] = [];
  const currentDate = new Date(from);

  while (currentDate <= to) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = currentDate.toISOString().split('T')[0];

    // Check for one-off schedule blocks first (highest priority)
    const dayBlocks = scheduleBlocks.filter((block) => {
      const blockDate = new Date(block.starts_at).toISOString().split('T')[0];
      return blockDate === dateStr;
    });

    if (dayBlocks.length > 0) {
      // Process schedule blocks
      for (const block of dayBlocks) {
        const startTime = new Date(block.starts_at).toTimeString().slice(0, 5);
        const endTime = new Date(block.ends_at).toTimeString().slice(0, 5);
        const isAllDay = startTime === '00:00' && endTime === '23:59';
        const serviceIds = (block.metadata?.service_ids as string[]) || [];

        slots.push({
          date: new Date(currentDate),
          startTime,
          endTime,
          serviceIds,
          type: isAllDay ? 'blocked' : 'exception',
        });
      }
    } else {
      // Check for recurring schedule blocks (exceptions)
      const recurringBlocks = recurringScheduleBlocks.filter((block) => {
        return block.day_of_week === dayOfWeek;
      });

      if (recurringBlocks.length > 0) {
        // Process recurring exceptions
        for (const block of recurringBlocks) {
          const serviceIds = (block.metadata?.service_ids as string[]) || [];

          slots.push({
            date: new Date(currentDate),
            startTime: block.start_time || '00:00',
            endTime: block.end_time || '23:59',
            serviceIds,
            type: 'exception',
          });
        }
      } else {
        // Use regular recurring schedules
        // Find blocks that belong to recurring schedules (not exceptions)
        const daySchedules = recurringScheduleBlocks.filter((block) => {
          const schedule = recurringSchedules.find((s) => s.id === block.recurring_schedule_id);
          if (!schedule) return false;

          // Skip if it's an exception
          if (schedule.metadata?.is_exception) return false;

          // Check date range
          const startDate = schedule.metadata?.start_date;
          const endDate = schedule.metadata?.end_date;
          if (startDate && dateStr < startDate) return false;
          if (endDate && dateStr > endDate) return false;

          return block.day_of_week === dayOfWeek;
        });

        for (const block of daySchedules) {
          const serviceIds = (block.metadata?.service_ids as string[]) || [];

          slots.push({
            date: new Date(currentDate),
            startTime: block.start_time || '09:00',
            endTime: block.end_time || '17:00',
            serviceIds,
            type: 'normal',
          });
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

