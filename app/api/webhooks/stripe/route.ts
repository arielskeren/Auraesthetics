import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSqlClient } from '@/app/_utils/db';
import { calFetch } from '@/lib/calClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const normalizeToE164 = (phone?: string | null): string | undefined => {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length > 10 && digits.length <= 15) {
    return digits.startsWith('+') ? digits : `+${digits}`;
  }
  if (phone.trim().startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return phone.trim();
  }
  return undefined;
};

type SqlClient = ReturnType<typeof getSqlClient>;

interface BookingRow {
  id: string | number;
  metadata?: any;
}

const shouldSkipAutoConfirm = (metadata: any, paymentIntentId: string) =>
  metadata?.calBooking?.status === 'confirmed' &&
  metadata?.calBooking?.paymentIntentId === paymentIntentId;

async function autoConfirmCalBooking({
  sql,
  booking,
  paymentIntent,
}: {
  sql: SqlClient;
  booking: BookingRow;
  paymentIntent: Stripe.PaymentIntent;
}) {
  const metadata =
    booking.metadata && typeof booking.metadata === 'object'
      ? booking.metadata
      : {};

  const selectedSlot = metadata.selectedSlot;
  const attendee = metadata.attendee;

  if (!selectedSlot?.eventTypeId || !selectedSlot?.startTime || !attendee?.name || !attendee?.email) {
    return;
  }

  if (!process.env.CAL_API_KEY) {
    console.warn('[Cal] CAL_API_KEY not configured; skipping auto-confirm.');
    return;
  }

  if (shouldSkipAutoConfirm(metadata, paymentIntent.id)) {
    return;
  }

  const attendeePayload: Record<string, unknown> = {
    name: attendee.name,
    email: attendee.email,
    timeZone: selectedSlot.timezone ?? 'America/New_York',
  };

  const sms = normalizeToE164(attendee.phone);
  if (sms) {
    attendeePayload.smsReminderNumber = sms;
  }

  const attemptInfo = {
    lastAttemptAt: new Date().toISOString(),
    paymentIntentId: paymentIntent.id,
  };

  try {
    const createResponse = await calFetch(
      'bookings',
      {
        start: selectedSlot.startTime,
        eventTypeId: Number(selectedSlot.eventTypeId),
        attendee: attendeePayload,
        metadata: {
          source: 'website',
          paymentId: paymentIntent.id,
          reservationId: metadata.reservation?.id ?? null,
          bookingId: booking.id,
        },
      },
      { family: 'bookings' }
    );

    if (!createResponse.ok) {
      const text = await createResponse.text();
      console.warn('[Cal] Booking creation failed', text);
      const failedMetadata = {
        ...metadata,
        calBooking: {
          status: 'error',
          error: text,
          ...attemptInfo,
        },
      };
      await sql`
        UPDATE bookings
        SET metadata = ${JSON.stringify(failedMetadata)}::jsonb,
            updated_at = NOW()
        WHERE id = ${booking.id}
      `;
      return;
    }

    const calBooking = await createResponse.json();

    const confirmResponse = await calFetch(
      `bookings/${calBooking.uid}/confirm`,
      undefined,
      { family: 'bookings', method: 'POST' }
    );

    if (!confirmResponse.ok) {
      const text = await confirmResponse.text();
      console.warn('[Cal] Booking confirm failed', text);
      const failedMetadata = {
        ...metadata,
        calBooking: {
          status: 'error',
          uid: calBooking.uid,
          error: text,
          ...attemptInfo,
        },
      };
      await sql`
        UPDATE bookings
        SET metadata = ${JSON.stringify(failedMetadata)}::jsonb,
            updated_at = NOW()
        WHERE id = ${booking.id}
      `;
      return;
    }

    const successMetadata = {
      ...metadata,
      calBooking: {
        status: 'confirmed',
        uid: calBooking.uid,
        confirmedAt: new Date().toISOString(),
        eventTypeId: Number(selectedSlot.eventTypeId),
        start: selectedSlot.startTime,
        timezone: selectedSlot.timezone ?? null,
        paymentIntentId: paymentIntent.id,
        ...attemptInfo,
      },
    };

    await sql`
      UPDATE bookings
      SET metadata = ${JSON.stringify(successMetadata)}::jsonb,
          updated_at = NOW()
      WHERE id = ${booking.id}
    `;
  } catch (error) {
    console.error('[Cal] Auto-confirm error', error);
    const failedMetadata = {
      ...metadata,
      calBooking: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        ...attemptInfo,
      },
    };
    await sql`
      UPDATE bookings
      SET metadata = ${JSON.stringify(failedMetadata)}::jsonb,
          updated_at = NOW()
      WHERE id = ${booking.id}
    `;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent succeeded:', paymentIntent.id);

        const paymentType = paymentIntent.metadata?.paymentType || 'full';
        const parseNumeric = (value: any, fallback = 0) => {
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          if (typeof value === 'string') {
            const parsed = parseFloat(value);
            if (Number.isFinite(parsed)) return parsed;
          }
          return fallback;
        };

        const existingResult = await sql`
          SELECT id, metadata, amount, deposit_amount, final_amount, payment_status
          FROM bookings
          WHERE payment_intent_id = ${paymentIntent.id}
          LIMIT 1
        `;

        const existingRows = Array.isArray(existingResult)
          ? existingResult
          : (existingResult as any)?.rows ?? [];

        if (existingRows.length > 0) {
          const booking = existingRows[0] as any;
          const existingMetadata =
            booking.metadata && typeof booking.metadata === 'object'
              ? booking.metadata
              : {};

          const depositAmountValue = paymentType === 'deposit'
            ? parseNumeric(paymentIntent.metadata?.depositAmount, paymentIntent.amount / 100)
            : parseNumeric(paymentIntent.metadata?.finalAmount, paymentIntent.amount / 100);
          const finalAmountValue = parseNumeric(
            paymentIntent.metadata?.finalAmount,
            paymentType === 'deposit'
              ? parseNumeric(existingMetadata?.paymentDetails?.finalAmount, depositAmountValue * 2)
              : depositAmountValue
          );
          const balanceDueValue = paymentType === 'deposit'
            ? Math.max(0, finalAmountValue - depositAmountValue)
            : 0;
          const amountValue = paymentType === 'deposit' ? depositAmountValue : finalAmountValue;
          const updatedMetadata = {
            ...existingMetadata,
            paymentType,
            paymentDetails: {
              ...(existingMetadata.paymentDetails || {}),
              paymentType,
              depositAmount: depositAmountValue,
              finalAmount: finalAmountValue,
              balanceDue: balanceDueValue,
              depositPercent: paymentType === 'deposit' ? (paymentIntent.metadata?.depositPercent || '50') : '100',
            },
            stripe: {
              ...(existingMetadata.stripe || {}),
              lastSucceededIntentAt: new Date().toISOString(),
            },
          };

          const paymentStatus =
            paymentType === 'deposit'
              ? booking.payment_status === 'paid'
                ? 'paid'
                : 'deposit_paid'
              : 'paid';

          try {
            await sql`
              UPDATE bookings 
              SET 
                payment_status = ${paymentStatus},
                amount = ${amountValue},
                deposit_amount = ${paymentType === 'deposit' ? depositAmountValue : amountValue},
                final_amount = ${finalAmountValue},
                metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
                updated_at = NOW()
              WHERE id = ${booking.id}
            `;
            await autoConfirmCalBooking({
              sql,
              booking: { id: booking.id, metadata: updatedMetadata },
              paymentIntent,
            });
          } catch (error) {
            console.error('Error updating booking:', error);
          }
        } else {
          // Fallback: update payment status only
          try {
            await sql`
              UPDATE bookings 
              SET 
                payment_status = ${paymentType === 'deposit' ? 'deposit_paid' : 'paid'},
                updated_at = NOW()
              WHERE payment_intent_id = ${paymentIntent.id}
            `;
          } catch (error) {
            console.error('Error updating booking:', error);
          }
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent failed:', paymentIntent.id);

        // Update booking record
        try {
          await sql`
            UPDATE bookings 
            SET 
              payment_status = 'failed',
              updated_at = NOW()
            WHERE payment_intent_id = ${paymentIntent.id}
          `;
        } catch (error) {
          console.error('Error updating booking:', error);
        }
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent canceled:', paymentIntent.id);

        // Update booking record
        try {
          await sql`
            UPDATE bookings 
            SET 
              payment_status = 'cancelled',
              updated_at = NOW()
            WHERE payment_intent_id = ${paymentIntent.id}
          `;
        } catch (error) {
          console.error('Error updating booking:', error);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log('Charge refunded:', charge.id);

        // Update booking record
        try {
          await sql`
            UPDATE bookings 
            SET 
              payment_status = 'refunded',
              updated_at = NOW()
            WHERE payment_intent_id = ${charge.payment_intent as string}
          `;
        } catch (error) {
          console.error('Error updating booking:', error);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Stripe webhooks require POST method only
export const runtime = 'nodejs';

