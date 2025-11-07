import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSqlClient } from '@/app/_utils/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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

