import { NextRequest, NextResponse } from 'next/server';
import { listRecurringSchedules, listRecurringScheduleBlocks } from '@/lib/hapioClient';
import { formatDateForHapioUTC } from '@/lib/hapioDateUtils';
import { getWeekdayFromHapioString } from '@/lib/hapioWeekdayUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    if (!from || !to) {
      return NextResponse.json(
        { error: 'from and to parameters are required' },
        { status: 400 }
      );
    }

    // Parse date range and normalize to start/end of day
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // Fetch recurring schedules
    const recurringSchedulesResponse = await listRecurringSchedules('resource', params.id, {
      per_page: 100,
    }).catch((err) => {
      console.error('[Availability API] Failed to fetch recurring schedules:', err);
      return { data: [], meta: { total: 0 } };
    });

    console.log('[Availability API] Recurring schedules:', {
      count: recurringSchedulesResponse.data?.length || 0,
      schedules: recurringSchedulesResponse.data?.map((s: any) => ({
        id: s.id,
        start_date: s.start_date,
        end_date: s.end_date,
      })),
    });

    // Group availability by date - store time ranges as objects
    const availabilityByDate: Record<string, Array<{ start: string; end: string }>> = {};

    // Process each recurring schedule
    if (recurringSchedulesResponse.data && Array.isArray(recurringSchedulesResponse.data)) {
      for (const schedule of recurringSchedulesResponse.data) {
        // Check if schedule is active for the date range
        const scheduleStart = schedule.start_date ? new Date(schedule.start_date) : null;
        if (scheduleStart) scheduleStart.setHours(0, 0, 0, 0);
        
        const scheduleEnd = schedule.end_date ? new Date(schedule.end_date) : null;
        if (scheduleEnd) scheduleEnd.setHours(23, 59, 59, 999);

        // Skip if schedule doesn't overlap with our date range
        if (scheduleEnd && scheduleEnd < fromDate) continue;
        if (scheduleStart && scheduleStart > toDate) continue;

        // Fetch blocks for this schedule
        try {
          const blocksResponse = await listRecurringScheduleBlocks('resource', params.id, {
            recurring_schedule_id: schedule.id,
            per_page: 100,
          }).catch(() => ({ data: [], meta: { total: 0 } }));

          if (blocksResponse.data && Array.isArray(blocksResponse.data)) {
            blocksResponse.data.forEach((block: any) => {
              // Get weekday (handle both string and number formats)
              const hapioWeekday = block.weekday ?? block.day_of_week;
              if (hapioWeekday === null || hapioWeekday === undefined) return;

              const weekday = getWeekdayFromHapioString(hapioWeekday);
              const startTime = block.start_time || '00:00';
              const endTime = block.end_time || '23:59';

              // Calculate which dates in the range fall on this weekday
              const currentDate = new Date(fromDate);
              while (currentDate <= toDate) {
                const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday

                // Check if this date matches the weekday
                if (dayOfWeek === weekday) {
                  // Normalize current date for comparison (ignore time)
                  const currentDateNormalized = new Date(currentDate);
                  currentDateNormalized.setHours(0, 0, 0, 0);
                  
                  // Check if date is within schedule's date range
                  const dateInRange = (!scheduleStart || currentDateNormalized >= scheduleStart) &&
                                     (!scheduleEnd || currentDateNormalized <= scheduleEnd);

                  if (dateInRange) {
                    // Add this date with the time range
                    const dateStr = currentDate.toISOString().split('T')[0];
                    if (!availabilityByDate[dateStr]) {
                      availabilityByDate[dateStr] = [];
                    }

                    // Add time range if not already present
                    const timeRange = { start: startTime, end: endTime };
                    const exists = availabilityByDate[dateStr].some(
                      (tr) => tr.start === startTime && tr.end === endTime
                    );
                    if (!exists) {
                      availabilityByDate[dateStr].push(timeRange);
                    }
                  }
                }

                // Always increment date to avoid infinite loop
                currentDate.setDate(currentDate.getDate() + 1);
              }
            });
          }
        } catch (err) {
          console.warn('[Availability API] Failed to fetch blocks for schedule', schedule.id, err);
        }
      }
    }

    // Sort time ranges for each date by start time
    Object.keys(availabilityByDate).forEach(date => {
      availabilityByDate[date].sort((a, b) => a.start.localeCompare(b.start));
    });

    // Now fetch recurring schedule blocks (exceptions that block availability)
    const recurringBlocksByDate: Record<string, Array<{ start: string; end: string; isAllDay: boolean }>> = {};
    
    // Fetch all recurring schedule blocks across all schedules
    if (recurringSchedulesResponse.data && Array.isArray(recurringSchedulesResponse.data)) {
      for (const schedule of recurringSchedulesResponse.data) {
        // Check if schedule is active for the date range
        const scheduleStart = schedule.start_date ? new Date(schedule.start_date) : null;
        if (scheduleStart) scheduleStart.setHours(0, 0, 0, 0);
        
        const scheduleEnd = schedule.end_date ? new Date(schedule.end_date) : null;
        if (scheduleEnd) scheduleEnd.setHours(23, 59, 59, 999);

        // Skip if schedule doesn't overlap with our date range
        if (scheduleEnd && scheduleEnd < fromDate) continue;
        if (scheduleStart && scheduleStart > toDate) continue;

        try {
          const blocksResponse = await listRecurringScheduleBlocks('resource', params.id, {
            recurring_schedule_id: schedule.id,
            per_page: 100,
          }).catch(() => ({ data: [], meta: { total: 0 } }));

          if (blocksResponse.data && Array.isArray(blocksResponse.data)) {
            blocksResponse.data.forEach((block: any) => {
              const hapioWeekday = block.weekday ?? block.day_of_week;
              if (hapioWeekday === null || hapioWeekday === undefined) return;

              const weekday = getWeekdayFromHapioString(hapioWeekday);
              const startTime = block.start_time || '00:00';
              const endTime = block.end_time || '23:59';
              const isAllDay = startTime === '00:00:00' && endTime === '23:59:59';

              // Calculate which dates in the range fall on this weekday
              const currentDate = new Date(fromDate);
              while (currentDate <= toDate) {
                const dayOfWeek = currentDate.getDay();

                if (dayOfWeek === weekday) {
                  const currentDateNormalized = new Date(currentDate);
                  currentDateNormalized.setHours(0, 0, 0, 0);
                  
                  const dateInRange = (!scheduleStart || currentDateNormalized >= scheduleStart) &&
                                     (!scheduleEnd || currentDateNormalized <= scheduleEnd);

                  if (dateInRange) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    if (!recurringBlocksByDate[dateStr]) {
                      recurringBlocksByDate[dateStr] = [];
                    }

                    // Add block time range
                    const timeRange = { start: startTime, end: endTime, isAllDay };
                    const exists = recurringBlocksByDate[dateStr].some(
                      (tr) => tr.start === startTime && tr.end === endTime
                    );
                    if (!exists) {
                      recurringBlocksByDate[dateStr].push(timeRange);
                    }
                  }
                }

                currentDate.setDate(currentDate.getDate() + 1);
              }
            });
          }
        } catch (err) {
          console.warn('[Availability API] Failed to fetch recurring blocks for schedule', schedule.id, err);
        }
      }
    }

    console.log('[Availability API] Final availability from recurring schedules:', {
      schedulesProcessed: recurringSchedulesResponse.data?.length || 0,
      availabilityDates: Object.keys(availabilityByDate).length,
      recurringBlocksDates: Object.keys(recurringBlocksByDate).length,
      sampleDates: Object.keys(availabilityByDate).slice(0, 5),
    });

    return NextResponse.json({ 
      availabilityByDate,
      recurringBlocksByDate,
    });
  } catch (error: any) {
    console.error('[Hapio] Failed to fetch availability', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve availability';
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      {
        error: message,
        details: error?.response?.data || null,
      },
      { status }
    );
  }
}
