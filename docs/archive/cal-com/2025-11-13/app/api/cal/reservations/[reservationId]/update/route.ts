import { NextRequest, NextResponse } from 'next/server';
import { calRequest } from '@/lib/calClient';

type UpdateRequestBody = {
  eventTypeId?: number;
  slotStart?: string;
  reservationDuration?: number | string | null;
  slotDuration?: number | string | null;
  timeZone?: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reservationId: string } }
) {
  const reservationId = params?.reservationId;

  if (!reservationId) {
    return NextResponse.json(
      { error: 'Reservation ID is required' },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as UpdateRequestBody;

    const payload: Record<string, any> = {};

    if (body.eventTypeId) {
      payload.eventTypeId = body.eventTypeId;
    }
    if (body.slotStart) {
      payload.slotStart = body.slotStart;
    }
    if (body.slotDuration) {
      payload.slotDuration = body.slotDuration;
    }
    if (body.reservationDuration) {
      payload.reservationDuration = body.reservationDuration;
    }
    if (body.timeZone) {
      payload.timeZone = body.timeZone;
    }

    if (!payload.eventTypeId || !payload.slotStart) {
      return NextResponse.json(
        { error: 'eventTypeId and slotStart are required to update reservation' },
        { status: 400 }
      );
    }

    const response = await calRequest<any>(
      'patch',
      `slots/reservations/${reservationId}`,
      payload
    );

    return NextResponse.json({
      success: true,
      data: response?.data ?? response,
    });
  } catch (error: any) {
    console.error('Failed to update reservation:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    return NextResponse.json(
      {
        error: 'Failed to update reservation',
        details: error.response?.data || error.message,
      },
      { status }
    );
  }
}


