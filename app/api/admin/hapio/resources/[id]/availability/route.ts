import { NextRequest, NextResponse } from 'next/server';
import { listResourceSchedule } from '@/lib/hapioClient';
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

    const response = await listResourceSchedule(params.id, {
      from,
      to,
      per_page: 1000, // Get all slots for the month
    });

    // Group slots by date and extract time ranges
    const availabilityByDate: Record<string, string[]> = {};

    if (response.data && Array.isArray(response.data)) {
      response.data.forEach((slot: any) => {
        if (slot.starts_at) {
          const slotDate = new Date(slot.starts_at);
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
      });

      // Sort times for each date
      Object.keys(availabilityByDate).forEach(date => {
        availabilityByDate[date].sort();
      });
    }

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

