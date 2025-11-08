import { NextRequest, NextResponse } from 'next/server';
import { calRequest } from '@/lib/calClient';

type ReserveRequestBody = {
  eventTypeId?: number;
  slotStart?: string;
  slotDuration?: number | string | null;
  reservationDuration?: number | string | null;
  timeZone?: string;
};

function normalizeReservationResponse(payload: any) {
  if (!payload) {
    return null;
  }

  const data = payload.data ?? payload;
  return {
    id: data.reservationUid ?? data.id ?? data.reservationId ?? null,
    expiresAt: data.reservationUntil ?? data.expiresAt ?? data.expires_at ?? null,
    startTime: data.slotStart ?? data.startTime ?? data.slot?.start ?? null,
    endTime: data.slotEnd ?? data.endTime ?? data.slot?.end ?? null,
    timezone: data.timeZone ?? data.timezone ?? data.slot?.timezone ?? null,
    raw: data,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReserveRequestBody;
  const eventTypeId = body.eventTypeId;
  const slotStart = body.slotStart;
  const timeZone = body.timeZone;
  const reservationDurationRaw = body.reservationDuration;

    if (!eventTypeId || !slotStart) {
      return NextResponse.json(
        { error: 'Missing required fields: eventTypeId, slotStart' },
        { status: 400 }
      );
    }

    const payload: Record<string, any> = {
      eventTypeId,
      slotStart,
    };

    const durationMinutes =
      typeof body.slotDuration === 'number'
        ? body.slotDuration
        : body.slotDuration
        ? Number(body.slotDuration)
        : null;
    if (durationMinutes && Number.isFinite(durationMinutes)) {
      payload.slotDuration = durationMinutes;
    }

    if (timeZone) {
      payload.timeZone = timeZone;
    }

    const reservationDuration =
      typeof reservationDurationRaw === 'number'
        ? reservationDurationRaw
        : reservationDurationRaw
        ? Number(reservationDurationRaw)
        : 2;
    if (reservationDuration && Number.isFinite(reservationDuration)) {
      payload.reservationDuration = reservationDuration;
    }

    const response = await calRequest<any>('post', 'slots/reservations', payload);

    const reservation = normalizeReservationResponse(response.data);

    if (!reservation?.id) {
      return NextResponse.json(
        { error: 'Reservation created but ID missing', details: response.data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      reservation,
    });
  } catch (error: any) {
    const responseData = error.response?.data || {};
    const message =
      responseData?.details?.message ||
      responseData?.message ||
      responseData?.error ||
      error.message ||
      'Failed to reserve Cal.com slot';
    console.error('Failed to reserve Cal.com slot:', responseData || error.message);
    const status = error.response?.status || 500;
    return NextResponse.json(
      {
        error: 'Failed to reserve Cal.com slot',
        details: responseData,
        message,
      },
      { status }
    );
  }
}


