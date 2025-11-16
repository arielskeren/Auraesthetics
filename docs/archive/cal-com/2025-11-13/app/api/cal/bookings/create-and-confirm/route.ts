import { NextRequest, NextResponse } from 'next/server';
import { calFetch } from '@/lib/calClient';

interface CreateAndConfirmPayload {
  start: string;
  eventTypeId: number;
  attendee: Record<string, unknown>;
  paymentId: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const { start, eventTypeId, attendee, paymentId, metadata }: CreateAndConfirmPayload =
      await request.json();

    if (!start || !eventTypeId || !attendee || !paymentId) {
      return NextResponse.json(
        { error: 'Missing required fields (start, eventTypeId, attendee, paymentId).' },
        { status: 400 }
      );
    }

    const createResponse = await calFetch(
      'bookings',
      {
        start,
        eventTypeId,
        attendee,
        metadata: {
          source: 'website',
          paymentId,
          ...(metadata || {}),
        },
      },
      { family: 'bookings' }
    );

    if (!createResponse.ok) {
      const text = await createResponse.text();
      return NextResponse.json(
        { error: `Create booking failed: ${text}` },
        { status: 400 }
      );
    }

    const booking = await createResponse.json();

    const confirmResponse = await calFetch(
      `bookings/${booking.uid}/confirm`,
      undefined,
      { family: 'bookings', method: 'POST' }
    );

    if (!confirmResponse.ok) {
      const text = await confirmResponse.text();
      return NextResponse.json(
        { error: `Confirm booking failed: ${text}` },
        { status: 400 }
      );
    }

    return NextResponse.json(booking);
  } catch (error: any) {
    console.error('[Cal] Create-and-confirm error', error);
    return NextResponse.json(
      { error: 'Failed to create and confirm booking.' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';


