import { NextRequest, NextResponse } from 'next/server';
import { finalizeBookingTransactional } from '@/lib/bookings/finalizeCore';

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, bookingId } = (await request.json()) as {
      paymentIntentId: string;
      bookingId: string;
    };
    if (!paymentIntentId || !bookingId) {
      return NextResponse.json({ error: 'Missing paymentIntentId or bookingId' }, { status: 400 });
    }

    const debug = request.nextUrl.searchParams.get('debug') === '1' || request.headers.get('x-debug') === '1';
    const result = await finalizeBookingTransactional({ paymentIntentId, hapioBookingId: bookingId, debug });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Bookings] finalize error', error);
    return NextResponse.json(
      { error: 'Failed to finalize booking', details: error?.message },
      { status: 500 }
    );
  }
}


