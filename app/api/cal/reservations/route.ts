import { NextRequest, NextResponse } from 'next/server';
import { calRequest } from '@/lib/calClient';

type ReserveRequestBody = {
  eventTypeId?: number;
  startTime?: string;
  endTime?: string | null;
  timezone?: string;
  attendee?: {
    name?: string;
    email?: string;
    smsReminderNumber?: string;
  };
  notes?: string;
  metadata?: Record<string, any>;
};

function normalizeReservationResponse(payload: any) {
  if (!payload) {
    return null;
  }

  const data = payload.data ?? payload;
  return {
    id: data.id ?? data.reservationId ?? null,
    expiresAt: data.expiresAt ?? data.expires_at ?? null,
    startTime: data.startTime ?? data.slot?.start ?? null,
    endTime: data.endTime ?? data.slot?.end ?? null,
    timezone: data.timezone ?? data.slot?.timezone ?? null,
    raw: data,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReserveRequestBody;
    const { eventTypeId, startTime, endTime, timezone, attendee, notes, metadata } = body;

    if (!eventTypeId || !startTime || !timezone) {
      return NextResponse.json(
        { error: 'Missing required fields: eventTypeId, startTime, timezone' },
        { status: 400 }
      );
    }

    if (!attendee?.email || !attendee?.name) {
      return NextResponse.json(
        { error: 'Missing attendee information: name and email are required' },
        { status: 400 }
      );
    }

    const payload = {
      slot: {
        start: startTime,
        end: endTime ?? null,
        timezone,
      },
      attendee: {
        name: attendee.name,
        email: attendee.email,
        smsReminderNumber: attendee.smsReminderNumber ?? null,
        timeZone: timezone,
      },
      metadata: {
        notes: notes ?? '',
        ...(metadata || {}),
      },
    };

    const response = await calRequest<any>(
      'post',
      `event-types/${eventTypeId}/reserve`,
      payload
    );

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
    console.error('Failed to reserve Cal.com slot:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    return NextResponse.json(
      {
        error: 'Failed to reserve Cal.com slot',
        details: error.response?.data || error.message,
      },
      { status }
    );
  }
}


