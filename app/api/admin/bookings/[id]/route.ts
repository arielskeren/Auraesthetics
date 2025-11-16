import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import Stripe from 'stripe';
import { cancelBooking as hapioCancelBooking } from '@/lib/hapioClient';
import { deleteOutlookEventForBooking } from '@/lib/outlookBookingSync';
import { sendBrevoEmail } from '@/lib/brevoClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const OUTLOOK_SYNC_ENABLED = process.env.OUTLOOK_SYNC_ENABLED !== 'false';

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

function ensureObject<T extends Record<string, any>>(value: any): T {
  return value && typeof value === 'object' ? { ...(value as T) } : ({} as T);
}

// Helper to fetch a booking by internal id, or fallback to hapio_booking_id
async function fetchBookingByAnyId(sql: any, idOrHapioId: string) {
  const primary = await sql`SELECT * FROM bookings WHERE id = ${idOrHapioId} LIMIT 1`;
  const primaryRows = normalizeRows(primary);
  if (primaryRows.length > 0) return primaryRows[0];
  const fallback = await sql`SELECT * FROM bookings WHERE hapio_booking_id = ${idOrHapioId} LIMIT 1`;
  const fallbackRows = normalizeRows(fallback);
  return fallbackRows[0] || null;
}

// GET /api/admin/bookings/[id] - Get booking details and client history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const bookingId = params.id;

    const bookingData = await fetchBookingByAnyId(sql, bookingId);
    if (!bookingData) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Get client history (last 5 bookings for same email)
    let clientHistory = [];
    if (bookingData.client_email) {
      const history = await sql`
        SELECT 
          id,
          service_name,
          booking_date,
          payment_type,
          payment_status,
          final_amount,
          created_at
        FROM bookings
        WHERE client_email = ${bookingData.client_email}
          AND id != ${bookingId}
        ORDER BY created_at DESC
        LIMIT 5
      `;
      clientHistory = normalizeRows(history);
    }

    return NextResponse.json({
      success: true,
      booking: bookingData,
      clientHistory,
    });
  } catch (error: any) {
    console.error('Error fetching booking details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking details', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/admin/bookings/[id]/regenerate-token - Regenerate booking token
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const action = body.action;
    const bookingId = params.id;

    if (action === 'regenerate-token') {
      // Call the regenerate token endpoint
      const response = await fetch(`${request.nextUrl.origin}/api/bookings/regenerate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });

      const data = await response.json();
      return NextResponse.json(data);
    }

    if (action === 'cancel') {
      // Cancel booking
      const sql = getSqlClient();
      const bookingData = await fetchBookingByAnyId(sql, bookingId);
      if (!bookingData) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      const bookingInternalId = bookingData.id;

      let refundProcessed = false;
      let refundId = null;

      const existingMetadata = ensureObject<Record<string, any>>(bookingData.metadata);
      const existingOutlookMeta = ensureObject<Record<string, any>>(existingMetadata.outlook);
      let outlookEventId = bookingData.outlook_event_id ?? existingOutlookMeta.eventId ?? null;
      let outlookSyncStatus = bookingData.outlook_sync_status ?? existingOutlookMeta.status ?? null;
      let outlookLastAttemptAt = existingOutlookMeta.lastAttemptAt ?? null;
      let outlookLastAction = existingOutlookMeta.lastAction ?? null;
      let outlookError = existingOutlookMeta.error ?? null;

      // If booking is paid, process refund first
      if (bookingData.payment_status === 'paid' && bookingData.payment_intent_id) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.payment_intent_id);
          
          if (paymentIntent.status === 'succeeded') {
            // Create refund
            const refund = await stripe.refunds.create({
              payment_intent: bookingData.payment_intent_id,
              amount: Math.round((Number(bookingData.final_amount) || 0) * 100), // Convert to cents
              reason: 'requested_by_customer',
            });
            
            refundProcessed = true;
            refundId = refund.id;
            console.log('✅ Refund processed for cancelled booking:', refund.id);
          }
        } catch (error: any) {
          console.error('⚠️  Error processing refund during cancellation:', error.message);
          // Continue with cancellation even if refund fails
        }
      }

      if (bookingData.hapio_booking_id) {
        try {
          await hapioCancelBooking(bookingData.hapio_booking_id);
        } catch (error: any) {
          console.error('⚠️  Error cancelling Hapio booking:', error?.message ?? error);
        }
      }

      if (OUTLOOK_SYNC_ENABLED && outlookEventId) {
        const attemptAt = new Date().toISOString();
        outlookLastAttemptAt = attemptAt;
        const removed = await deleteOutlookEventForBooking({
          id: bookingData.id,
          service_id: bookingData.service_id ?? null,
          service_name: bookingData.service_name ?? null,
          client_name: bookingData.client_name ?? null,
          client_email: bookingData.client_email ?? null,
          metadata: existingMetadata,
          booking_date: bookingData.booking_date ?? null,
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

      let updatedMetadata: any = {
        ...existingMetadata,
        cancelledAt: new Date().toISOString(),
        outlook: {
          ...existingOutlookMeta,
          eventId: outlookEventId,
          status: outlookSyncStatus,
          lastAttemptAt: outlookLastAttemptAt,
          lastAction: outlookLastAction,
          error: outlookError,
        },
      };
      
      if (refundProcessed && refundId) {
        updatedMetadata.refundId = refundId;
      }
      
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
        WHERE id = ${bookingInternalId}
      `;

      // Record event
      await sql`
        INSERT INTO booking_events (booking_id, type, data)
        VALUES (${bookingInternalId}, ${'cancelled'}, ${JSON.stringify({ refundProcessed, refundId })}::jsonb)
      `;

      // Send cancellation email (best-effort)
      if (bookingData.client_email) {
        try {
          await sendBrevoEmail({
            to: [{ email: bookingData.client_email, name: bookingData.client_name || undefined }],
            subject: 'Your appointment has been cancelled',
            htmlContent: `<p>Your appointment for <strong>${bookingData.service_name || 'your service'}</strong> on ${bookingData.booking_date || ''} has been cancelled.</p>`,
            tags: ['booking_cancelled'],
          });
          await sql`
            INSERT INTO booking_events (booking_id, type, data)
            VALUES (${bookingInternalId}, ${'email_sent'}, ${JSON.stringify({ kind: 'booking_cancelled' })}::jsonb)
          `;
        } catch (e) {
          console.error('[Brevo] cancel email failed', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: refundProcessed 
          ? 'Booking cancelled and refund processed successfully' 
          : 'Booking cancelled successfully',
        refunded: refundProcessed,
        refundId: refundId,
      });
    }

    if (action === 'refund') {
      // Process refund via Stripe
      const sql = getSqlClient();
      const bookingData = await fetchBookingByAnyId(sql, bookingId);
      if (!bookingData) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      const bookingInternalId = bookingData.id;

      if (!bookingData.payment_intent_id) {
        return NextResponse.json(
          { error: 'No payment intent found for this booking' },
          { status: 400 }
        );
      }

      try {
        const requestedPercent = typeof body?.percentage === 'number' ? body.percentage : null;
        const requestedAmountCents = typeof body?.amountCents === 'number' ? body.amountCents : null;

        // Retrieve payment intent
        const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.payment_intent_id);
        
        if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json(
            { error: 'Payment not succeeded, cannot refund' },
            { status: 400 }
          );
        }

        // Determine refund amount
        const totalCents = Math.round((Number(bookingData.final_amount) || 0) * 100);
        let refundCents = totalCents;
        if (requestedAmountCents && requestedAmountCents > 0 && requestedAmountCents <= totalCents) {
          refundCents = requestedAmountCents;
        } else if (requestedPercent && requestedPercent > 0 && requestedPercent <= 100) {
          refundCents = Math.round((requestedPercent / 100) * totalCents);
        }

        // Create refund
        const refund = await stripe.refunds.create({
          payment_intent: bookingData.payment_intent_id,
          amount: refundCents,
          reason: 'requested_by_customer',
        });

        // Update booking status to refunded (but do NOT cancel the booking)
        // The booking remains active, just marked as refunded
        await sql`
          UPDATE bookings
          SET 
            payment_status = 'refunded',
            metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{refundId}',
              ${JSON.stringify(refund.id)}::jsonb
            ),
            metadata = jsonb_set(
              metadata,
              '{refundedAt}',
              ${JSON.stringify(new Date().toISOString())}::jsonb
            ),
            metadata = jsonb_set(
              metadata,
              '{refundAmountCents}',
              ${JSON.stringify(refundCents)}::jsonb
            ),
            updated_at = NOW()
          WHERE id = ${bookingInternalId}
        `;

        // Record event
        await sql`
          INSERT INTO booking_events (booking_id, type, data)
          VALUES (${bookingInternalId}, ${'refund'}, ${JSON.stringify({ refundId: refund.id, amount_cents: refundCents })}::jsonb)
        `;

        // Send refund email (best-effort)
        if (bookingData.client_email) {
          try {
            await sendBrevoEmail({
              to: [{ email: bookingData.client_email, name: bookingData.client_name || undefined }],
              subject: 'Your refund has been issued',
              htmlContent: `<p>A refund for <strong>$${(refundCents / 100).toFixed(2)}</strong> has been issued for your appointment ${bookingData.service_name ? `(${bookingData.service_name})` : ''}.</p>`,
              tags: ['booking_refunded'],
            });
            await sql`
              INSERT INTO booking_events (booking_id, type, data)
              VALUES (${bookingId}, ${'email_sent'}, ${JSON.stringify({ kind: 'booking_refunded' })}::jsonb)
            `;
          } catch (e) {
            console.error('[Brevo] refund email failed', e);
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Refund processed successfully. Booking remains active (not cancelled).',
          refundId: refund.id,
        });
      } catch (error: any) {
        console.error('Error processing refund:', error);
        return NextResponse.json(
          { error: 'Failed to process refund', details: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error processing booking action:', error);
    return NextResponse.json(
      { error: 'Failed to process action', details: error.message },
      { status: 500 }
    );
  }
}

