import { NextRequest, NextResponse } from 'next/server';
import { listResourceSchedule, listRecurringSchedules } from '@/lib/hapioClient';
import { formatDateForHapioUTC } from '@/lib/hapioDateUtils';

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

    // Fetch the schedule (bookable slots) - this includes recurring schedules
    const scheduleResponse = await listResourceSchedule(params.id, {
      from,
      to,
      per_page: 1000,
    }).catch((err) => {
      console.error('[Availability API] Failed to fetch schedule:', err);
      return { data: [], meta: { total: 0 } };
    });

    console.log('[Availability API] Schedule response:', {
      hasData: !!scheduleResponse.data,
      dataType: Array.isArray(scheduleResponse.data) ? 'array' : typeof scheduleResponse.data,
      dataLength: Array.isArray(scheduleResponse.data) ? scheduleResponse.data.length : 'N/A',
      firstItem: Array.isArray(scheduleResponse.data) && scheduleResponse.data.length > 0 ? scheduleResponse.data[0] : null,
      meta: scheduleResponse.meta,
    });

    // Group slots by date and extract time ranges
    const availabilityByDate: Record<string, string[]> = {};

    // Process schedule slots (bookable times)
    // The response might be an array directly or wrapped in a data property
    const slots = Array.isArray(scheduleResponse.data) 
      ? scheduleResponse.data 
      : Array.isArray(scheduleResponse) 
        ? scheduleResponse 
        : [];

    slots.forEach((slot: any) => {
      // Handle different possible field names
      const startsAt = slot.starts_at || slot.startsAt || slot.start_time || slot.start;
      
      if (startsAt) {
        try {
          const slotDate = new Date(startsAt);
          if (!isNaN(slotDate.getTime())) {
            const dateStr = slotDate.toISOString().split('T')[0];
            const timeStr = slotDate.toTimeString().slice(0, 5); // HH:mm format
            
            if (!availabilityByDate[dateStr]) {
              availabilityByDate[dateStr] = [];
            }
            
            // Add time if not already present (avoid duplicates)
            if (!availabilityByDate[dateStr].includes(timeStr)) {
              availabilityByDate[dateStr].push(timeStr);
            }
          }
        } catch (err) {
          console.warn('[Availability API] Failed to parse date:', startsAt, err);
        }
      }
    });

    // Sort times for each date
    Object.keys(availabilityByDate).forEach(date => {
      availabilityByDate[date].sort();
    });

    console.log('[Availability API] Final availability:', {
      totalSlots: slots.length,
      availabilityDates: Object.keys(availabilityByDate).length,
      sampleDates: Object.keys(availabilityByDate).slice(0, 5),
    });

    return NextResponse.json({ availabilityByDate });
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

