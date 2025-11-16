import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripeClient';
import { confirmBooking } from '@/lib/hapioClient';

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, bookingId } = (await request.json()) as {
      paymentIntentId: string;
      bookingId: string;
    };
    if (!paymentIntentId || !bookingId) {
      return NextResponse.json({ error: 'Missing paymentIntentId or bookingId' }, { status: 400 });
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const status = pi.status;
    if (!['succeeded', 'processing', 'requires_capture'].includes(status)) {
      return NextResponse.json(
        { error: `PaymentIntent not chargeable for booking. Status: ${status}` },
        { status: 400 }
      );
    }

    const booking = await confirmBooking(bookingId, { isTemporary: false });
    return NextResponse.json({ booking });
  } catch (error: any) {
    console.error('[Bookings] finalize error', error);
    return NextResponse.json(
      { error: 'Failed to finalize booking', details: error?.message },
      { status: 500 }
    );
  }
}


