import { NextRequest, NextResponse } from 'next/server';
import { calFetch } from '@/lib/calClient';

interface ReservePayload {
  eventTypeId?: number;
  slotStart?: string;
  slotDuration?: number;
  reservationDuration?: number;
  timeZone?: string;
}

function normalizeReservation(payload: any) {
  if (!payload) return null;
  const data = payload.data ?? payload;
  return {
    id: data.reservationUid ?? data.id ?? data.reservationId ?? null,
    slotStart: data.slotStart ?? data.startTime ?? data.slot?.start ?? null,
    slotEnd: data.slotEnd ?? data.endTime ?? data.slot?.end ?? null,
    timeZone: data.timeZone ?? data.timezone ?? data.slot?.timezone ?? null,
    expiresAt: data.reservationUntil ?? data.expiresAt ?? data.expires_at ?? null,
    raw: data,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReservePayload;
    const { eventTypeId, slotStart, slotDuration, reservationDuration, timeZone } = body;

    if (!eventTypeId || !slotStart) {
      return NextResponse.json(
        { error: 'Missing required fields: eventTypeId, slotStart' },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      eventTypeId,
      slotStart,
    };

    if (typeof slotDuration === 'number' && Number.isFinite(slotDuration)) {
      payload.slotDuration = slotDuration;
    }

    if (typeof reservationDuration === 'number' && Number.isFinite(reservationDuration)) {
      payload.reservationDuration = reservationDuration;
    }

    if (timeZone) {
      payload.timeZone = timeZone;
    }

    const response = await calFetch('slots/reservations', payload, { family: 'slots' });
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Failed to create Cal.com slot reservation',
          details: json,
        },
        { status: response.status }
      );
    }

    const reservation = normalizeReservation(json);

    if (!reservation?.id) {
      return NextResponse.json(
        { error: 'Reservation created but response missing ID', details: json },
        { status: 502 }
      );
    }

    // NOTE: Persist reservation metadata (id, slotStart, expiresAt) alongside the booking session if desired.

    return NextResponse.json({
      success: true,
      reservation,
    });
  } catch (error: any) {
    console.error('[Cal] Slot reservation error', error);
    return NextResponse.json(
      {
        error: 'Failed to create Cal.com slot reservation',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';


