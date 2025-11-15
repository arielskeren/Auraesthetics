import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSqlClient } from '@/app/_utils/db';
import { confirmBooking, cancelBooking } from '@/lib/hapioClient';
import { ensureOutlookEventForBooking, deleteOutlookEventForBooking } from '@/lib/outlookBookingSync';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const OUTLOOK_SYNC_ENABLED = process.env.OUTLOOK_SYNC_ENABLED !== 'false';

type SqlClient = ReturnType<typeof getSqlClient>;

interface BookingRow {
  id: string | number;
  service_id: string | null;
  service_name: string | null;
  client_name: string | null;
  client_email: string | null;
  booking_date: string | null;
  metadata?: any;
  payment_status?: string | null;
  hapio_booking_id?: string | null;
  outlook_event_id?: string | null;
  outlook_sync_status?: string | null;
}

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

function ensureObject(value: any) {
  return value && typeof value === 'object' ? { ...value } : {};
}

const parseNumeric = (value: any, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

async function findBooking(
  sql: SqlClient,
  identifiers: { hapioBookingId?: string | null; paymentIntentId?: string | null }
): Promise<BookingRow | null> {
  if (identifiers.hapioBookingId) {
    const result = await sql`
      SELECT 
        id,
        service_id,
        service_name,
        client_name,
        client_email,
        booking_date,
        metadata,
        payment_status,
        hapio_booking_id,
        outlook_event_id,
        outlook_sync_status
      FROM bookings
      WHERE hapio_booking_id = ${identifiers.hapioBookingId}
      LIMIT 1
    `;
    const rows = normalizeRows(result);
    if (rows.length > 0) {
      return rows[0] as BookingRow;
    }
  }

  if (identifiers.paymentIntentId) {
    const result = await sql`
      SELECT 
        id,
        service_id,
        service_name,
        client_name,
        client_email,
        booking_date,
        metadata,
        payment_status,
        hapio_booking_id,
        outlook_event_id,
        outlook_sync_status
      FROM bookings
      WHERE payment_intent_id = ${identifiers.paymentIntentId}
      LIMIT 1
    `;
    const rows = normalizeRows(result);
    if (rows.length > 0) {
      return rows[0] as BookingRow;
  }
  }

  return null;
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

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent succeeded:', paymentIntent.id);

        const hapioBookingId = paymentIntent.metadata?.hapioBookingId;
        const booking = await findBooking(sql, {
          hapioBookingId,
          paymentIntentId: paymentIntent.id,
        });

        if (!booking) {
          console.warn('[Stripe webhook] Booking not found for PaymentIntent', paymentIntent.id);
          break;
        }

        const paymentType = paymentIntent.metadata?.paymentType || 'full';
          const depositAmountValue = paymentType === 'deposit'
            ? parseNumeric(paymentIntent.metadata?.depositAmount, paymentIntent.amount / 100)
            : parseNumeric(paymentIntent.metadata?.finalAmount, paymentIntent.amount / 100);
          const finalAmountValue = parseNumeric(
            paymentIntent.metadata?.finalAmount,
            paymentType === 'deposit'
            ? depositAmountValue * 2
              : depositAmountValue
          );
        const balanceDueValue =
          paymentType === 'deposit' ? Math.max(0, finalAmountValue - depositAmountValue) : 0;
          const amountValue = paymentType === 'deposit' ? depositAmountValue : finalAmountValue;

        const existingMetadata = ensureObject(booking.metadata);
        const existingOutlookMeta = ensureObject(existingMetadata.outlook);
        let outlookEventId = booking.outlook_event_id ?? existingOutlookMeta.eventId ?? null;
        let outlookSyncStatus = booking.outlook_sync_status ?? existingOutlookMeta.status ?? null;
        let outlookError: string | null = null;
        let outlookLastAction: string | null = null;
        let outlookLastAttemptAt = existingOutlookMeta.lastAttemptAt ?? null;

        let hapioStatus: 'confirmed' | 'error' = 'confirmed';
        let hapioError: string | undefined;

        if (hapioBookingId) {
          try {
            await confirmBooking(hapioBookingId, {
              metadata: {
                stripePaymentIntentId: paymentIntent.id,
                stripeChargeId:
                  typeof paymentIntent.latest_charge === 'string'
                    ? paymentIntent.latest_charge
                    : undefined,
              },
            });
          } catch (error: any) {
            hapioStatus = 'error';
            hapioError = error?.message || 'Hapio confirmation failed';
            console.error('[Hapio] Confirm booking failed', error);
          }
        }

        if (OUTLOOK_SYNC_ENABLED && hapioStatus === 'confirmed') {
          const attemptAt = new Date().toISOString();
          outlookLastAttemptAt = attemptAt;
          try {
            const outlookResult = await ensureOutlookEventForBooking({
              id: booking.id,
              service_id: booking.service_id ?? null,
              service_name: booking.service_name ?? null,
              client_name: booking.client_name ?? null,
              client_email: booking.client_email ?? null,
              metadata: existingMetadata,
              booking_date: booking.booking_date ?? null,
              outlook_event_id: outlookEventId ?? null,
            });

            outlookEventId = outlookResult.eventId ?? outlookEventId ?? null;
            outlookLastAction = outlookResult.action;
            outlookSyncStatus =
              outlookResult.action === 'created' || outlookResult.action === 'updated'
                ? 'synced'
                : outlookResult.action;
            outlookError = null;
          } catch (outlookErr: any) {
            outlookLastAction = 'error';
            outlookSyncStatus = 'error';
            outlookError = outlookErr?.message ?? 'Failed to sync Outlook event';
            console.error('[Outlook] Sync failed', outlookErr);
          }
        }

          const updatedMetadata = {
            ...existingMetadata,
            paymentType,
            paymentDetails: {
              ...(existingMetadata.paymentDetails || {}),
              paymentType,
              depositAmount: depositAmountValue,
              finalAmount: finalAmountValue,
              balanceDue: balanceDueValue,
            depositPercent:
              paymentIntent.metadata?.depositPercent ||
              (paymentType === 'deposit' ? '50' : '100'),
            },
            stripe: {
              ...(existingMetadata.stripe || {}),
              lastSucceededIntentAt: new Date().toISOString(),
            latestPaymentIntentId: paymentIntent.id,
            latestChargeId:
              typeof paymentIntent.latest_charge === 'string'
                ? paymentIntent.latest_charge
                : existingMetadata.stripe?.latestChargeId ?? null,
          },
          hapio: {
            ...(existingMetadata.hapio || {}),
            bookingId: hapioBookingId ?? existingMetadata.hapio?.bookingId ?? null,
            status: hapioStatus,
            lastConfirmAttemptAt: new Date().toISOString(),
            confirmedAt:
              hapioStatus === 'confirmed'
                ? new Date().toISOString()
                : existingMetadata.hapio?.confirmedAt ?? null,
            error: hapioError,
          },
          outlook: {
            ...existingOutlookMeta,
            eventId: outlookEventId,
            status: outlookSyncStatus,
            lastAttemptAt: outlookLastAttemptAt,
            lastAction: outlookLastAction,
            error: outlookError,
            },
          };

          const paymentStatus =
          paymentType === 'deposit' ? 'deposit_paid' : 'paid';

          try {
            await sql`
              UPDATE bookings 
              SET 
                payment_status = ${paymentStatus},
                amount = ${amountValue},
                deposit_amount = ${paymentType === 'deposit' ? depositAmountValue : amountValue},
                final_amount = ${finalAmountValue},
              payment_intent_id = ${paymentIntent.id},
              outlook_event_id = ${outlookEventId},
              outlook_sync_status = ${outlookSyncStatus ?? null},
              outlook_sync_log = ${JSON.stringify({
                lastAction: outlookLastAction,
                lastAttemptAt: outlookLastAttemptAt,
                error: outlookError,
              })}::jsonb,
                metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
                updated_at = NOW()
              WHERE id = ${booking.id}
            `;
          } catch (error) {
          console.error('Error updating booking after payment success:', error);
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent failed:', paymentIntent.id);

        const hapioBookingId = paymentIntent.metadata?.hapioBookingId;
        const booking = await findBooking(sql, {
          hapioBookingId,
          paymentIntentId: paymentIntent.id,
        });

        if (!booking) {
          break;
        }

        if (hapioBookingId) {
          try {
            await cancelBooking(hapioBookingId);
          } catch (error) {
            console.error('[Hapio] Cancel booking failed', error);
          }
        }

        const existingMetadata = ensureObject(booking.metadata);
        const existingOutlookMeta = ensureObject(existingMetadata.outlook);
        let outlookEventId = booking.outlook_event_id ?? existingOutlookMeta.eventId ?? null;
        let outlookSyncStatus = booking.outlook_sync_status ?? existingOutlookMeta.status ?? null;
        let outlookLastAttemptAt = existingOutlookMeta.lastAttemptAt ?? null;
        let outlookError = existingOutlookMeta.error ?? null;
        let outlookLastAction = existingOutlookMeta.lastAction ?? null;

        if (OUTLOOK_SYNC_ENABLED && outlookEventId) {
          const attemptAt = new Date().toISOString();
          outlookLastAttemptAt = attemptAt;
          const removed = await deleteOutlookEventForBooking({
            id: booking.id,
            service_id: booking.service_id ?? null,
            service_name: booking.service_name ?? null,
            client_name: booking.client_name ?? null,
            client_email: booking.client_email ?? null,
            metadata: existingMetadata,
            booking_date: booking.booking_date ?? null,
            outlook_event_id: outlookEventId,
          });
          if (removed) {
            outlookEventId = null;
            outlookSyncStatus = 'cancelled';
            outlookLastAction = 'deleted';
            outlookError = null;
          } else {
            outlookSyncStatus = 'error';
            outlookLastAction = 'delete_failed';
            outlookError = 'Failed to delete Outlook event';
          }
        }

        const updatedMetadata = {
          ...existingMetadata,
          stripe: {
            ...(existingMetadata.stripe || {}),
            lastFailureAt: new Date().toISOString(),
            lastFailureReason: paymentIntent.last_payment_error?.message ?? null,
          },
          hapio: {
            ...(existingMetadata.hapio || {}),
            bookingId: hapioBookingId ?? existingMetadata.hapio?.bookingId ?? null,
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
          },
          outlook: {
            ...existingOutlookMeta,
            eventId: outlookEventId,
            status: outlookSyncStatus,
            lastAttemptAt: outlookLastAttemptAt,
            lastAction: outlookLastAction,
            error: outlookError,
          },
        };

        try {
          await sql`
            UPDATE bookings 
            SET 
              payment_status = 'failed',
              outlook_event_id = ${outlookEventId},
              outlook_sync_status = ${outlookSyncStatus ?? null},
              outlook_sync_log = ${JSON.stringify({
                lastAction: outlookLastAction,
                lastAttemptAt: outlookLastAttemptAt,
                error: outlookError,
              })}::jsonb,
              metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
              updated_at = NOW()
            WHERE id = ${booking.id}
          `;
        } catch (error) {
          console.error('Error updating booking after payment failure:', error);
        }
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent canceled:', paymentIntent.id);

        const hapioBookingId = paymentIntent.metadata?.hapioBookingId;
        const booking = await findBooking(sql, {
          hapioBookingId,
          paymentIntentId: paymentIntent.id,
        });

        if (!booking) {
          break;
        }

        if (hapioBookingId) {
          try {
            await cancelBooking(hapioBookingId);
          } catch (error) {
            console.error('[Hapio] Cancel booking failed', error);
          }
        }

        const existingMetadata = ensureObject(booking.metadata);
        const existingOutlookMeta = ensureObject(existingMetadata.outlook);
        let outlookEventId = booking.outlook_event_id ?? existingOutlookMeta.eventId ?? null;
        let outlookSyncStatus = booking.outlook_sync_status ?? existingOutlookMeta.status ?? null;
        let outlookLastAttemptAt = existingOutlookMeta.lastAttemptAt ?? null;
        let outlookError = existingOutlookMeta.error ?? null;
        let outlookLastAction = existingOutlookMeta.lastAction ?? null;

        if (OUTLOOK_SYNC_ENABLED && outlookEventId) {
          const attemptAt = new Date().toISOString();
          outlookLastAttemptAt = attemptAt;
          const removed = await deleteOutlookEventForBooking({
            id: booking.id,
            service_id: booking.service_id ?? null,
            service_name: booking.service_name ?? null,
            client_name: booking.client_name ?? null,
            client_email: booking.client_email ?? null,
            metadata: existingMetadata,
            booking_date: booking.booking_date ?? null,
            outlook_event_id: outlookEventId,
          });
          if (removed) {
            outlookEventId = null;
            outlookSyncStatus = 'cancelled';
            outlookLastAction = 'deleted';
            outlookError = null;
          } else {
            outlookSyncStatus = 'error';
            outlookLastAction = 'delete_failed';
            outlookError = 'Failed to delete Outlook event';
          }
        }

        const updatedMetadata = {
          ...existingMetadata,
          stripe: {
            ...(existingMetadata.stripe || {}),
            lastCancelledAt: new Date().toISOString(),
          },
          hapio: {
            ...(existingMetadata.hapio || {}),
            bookingId: hapioBookingId ?? existingMetadata.hapio?.bookingId ?? null,
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
          },
          outlook: {
            ...existingOutlookMeta,
            eventId: outlookEventId,
            status: outlookSyncStatus,
            lastAttemptAt: outlookLastAttemptAt,
            lastAction: outlookLastAction,
            error: outlookError,
          },
        };

        try {
          await sql`
            UPDATE bookings 
            SET 
              payment_status = 'cancelled',
              outlook_event_id = ${outlookEventId},
              outlook_sync_status = ${outlookSyncStatus ?? null},
              outlook_sync_log = ${JSON.stringify({
                lastAction: outlookLastAction,
                lastAttemptAt: outlookLastAttemptAt,
                error: outlookError,
              })}::jsonb,
              metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
              updated_at = NOW()
            WHERE id = ${booking.id}
          `;
        } catch (error) {
          console.error('Error updating booking after cancellation:', error);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log('Charge refunded:', charge.id);

        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;

        const booking = await findBooking(sql, {
          hapioBookingId: undefined,
          paymentIntentId,
        });

        if (!booking) {
          break;
        }

        const existingMetadata = ensureObject(booking.metadata);
        const updatedMetadata = {
          ...existingMetadata,
          stripe: {
            ...(existingMetadata.stripe || {}),
            lastRefundAt: new Date().toISOString(),
            lastRefundId: charge.id,
          },
        };

        try {
          await sql`
            UPDATE bookings 
            SET 
              payment_status = 'refunded',
              metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
              updated_at = NOW()
            WHERE id = ${booking.id}
          `;
        } catch (error) {
          console.error('Error updating booking after refund:', error);
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

