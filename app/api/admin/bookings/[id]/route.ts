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

    const rawBooking = await fetchBookingByAnyId(sql, bookingId);
    if (!rawBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Single query for booking + customer + payment, parallel query for history
    const [bookingResult, historyResult] = await Promise.all([
      sql`
        SELECT 
          b.*,
          TRIM(COALESCE(c.first_name || ' ', '') || COALESCE(c.last_name, '')) AS enriched_client_name,
          COALESCE(c.email, b.client_email) AS enriched_client_email,
          COALESCE(c.phone, b.client_phone) AS enriched_client_phone,
          (SELECT amount_cents FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) AS payment_amount_cents,
          (SELECT status FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) AS payment_status_override
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        WHERE b.id = ${rawBooking.id}
        LIMIT 1
      `,
      rawBooking.client_email ? sql`
        SELECT id, service_name, booking_date, payment_type, payment_status, final_amount, created_at
        FROM bookings
        WHERE client_email = ${rawBooking.client_email} AND id != ${rawBooking.id}
        ORDER BY created_at DESC LIMIT 5
      ` : Promise.resolve([])
    ]);
    
    const bookingRows = normalizeRows(bookingResult);
    if (bookingRows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const row = bookingRows[0];
    const finalAmount = row.payment_amount_cents ? row.payment_amount_cents / 100 : null;
    const clientHistory = normalizeRows(historyResult);

    const bookingData = {
      ...row,
      client_name: (row.enriched_client_name?.trim()) || row.client_name,
      client_email: row.enriched_client_email || row.client_email,
      client_phone: row.enriched_client_phone || row.client_phone,
      amount: finalAmount,
      final_amount: finalAmount,
      payment_status: row.payment_status_override || row.payment_status,
    };

    delete (bookingData as any).enriched_client_name;
    delete (bookingData as any).enriched_client_email;
    delete (bookingData as any).enriched_client_phone;
    delete (bookingData as any).payment_amount_cents;
    delete (bookingData as any).payment_status_override;

    return NextResponse.json({ success: true, booking: bookingData, clientHistory });
  } catch (error: any) {
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
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
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
          }
        } catch (error: any) {
          // Continue with cancellation even if refund fails
        }
      }

      if (bookingData.hapio_booking_id) {
        try {
          await hapioCancelBooking(bookingData.hapio_booking_id);
        } catch (error: any) {
          // Continue even if Hapio cancel fails
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
          // Email send failure is non-critical
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
            // Email send failure is non-critical
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Refund processed successfully. Booking remains active (not cancelled).',
          refundId: refund.id,
        });
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Failed to process refund', details: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process action', details: error.message },
      { status: 500 }
    );
  }
}

