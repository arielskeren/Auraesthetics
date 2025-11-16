import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripeClient';
import { confirmBooking } from '@/lib/hapioClient';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('stripe-signature') || '';
    const rawBody = Buffer.from(await request.arrayBuffer());
    const event = constructWebhookEvent(rawBody, signature);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        const bookingId = pi.metadata?.hapio_booking_id || null;
        if (bookingId) {
          try {
            await confirmBooking(bookingId, { isTemporary: false });
          } catch (e) {
            console.error('[Stripe Webhook] Booking finalize failed', e);
          }
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}

