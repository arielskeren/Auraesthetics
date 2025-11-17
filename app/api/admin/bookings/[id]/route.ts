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

// Helper function to check admin authentication
function checkAdminAuth(request: NextRequest): boolean {
  const token = request.nextUrl.searchParams.get('token') || request.headers.get('x-admin-token');
  const expectedToken = process.env.ADMIN_TOKEN || process.env.ADMIN_DIAG_TOKEN;
  
  if (process.env.NODE_ENV === 'development' && !expectedToken) {
    return true;
  }
  
  return token === expectedToken;
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
    // Basic admin authentication check
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin token required.' },
        { status: 401 }
      );
    }

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
        SELECT 
          b.id, 
          b.service_name, 
          b.booking_date, 
          b.payment_status, 
          b.created_at,
          COALESCE(p.amount_cents, 0) as amount_cents
        FROM bookings b
        LEFT JOIN payments p ON p.booking_id = b.id
        WHERE b.client_email = ${rawBooking.client_email} AND b.id != ${rawBooking.id}
        ORDER BY b.created_at DESC LIMIT 5
      ` : Promise.resolve([])
    ]);
    
    const bookingRows = normalizeRows(bookingResult);
    if (bookingRows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const row = bookingRows[0];
    const finalAmount = row.payment_amount_cents ? row.payment_amount_cents / 100 : null;
    const clientHistory = normalizeRows(historyResult).map((h: any) => ({
      ...h,
      final_amount: h.amount_cents ? h.amount_cents / 100 : null,
      payment_type: null, // Removed column
    }));

    const bookingData = {
      ...row,
      client_name: (row.enriched_client_name?.trim()) || row.client_name,
      client_email: row.enriched_client_email || row.client_email,
      client_phone: row.enriched_client_phone || row.client_phone,
      amount: finalAmount,
      final_amount: finalAmount, // Synthetic field for UI compatibility
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
    // Basic admin authentication check
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin token required.' },
        { status: 401 }
      );
    }

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

      // If booking is paid, process refund first (check both 'paid' and 'succeeded')
      const isPaid = (bookingData.payment_status === 'paid' || bookingData.payment_status === 'succeeded') && bookingData.payment_intent_id;
      if (isPaid) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.payment_intent_id);
          
          if (paymentIntent.status === 'succeeded') {
            // Create refund
            // Get payment amount from payments table
            const paymentRows = await sql`
              SELECT amount_cents FROM payments 
              WHERE booking_id = ${bookingInternalId} 
              ORDER BY created_at DESC LIMIT 1
            `;
            const paymentRow = normalizeRows(paymentRows)[0];
            if (!paymentRow || !paymentRow.amount_cents) {
              throw new Error('Payment record not found for booking');
            }
            const paymentAmount = paymentRow.amount_cents;
            
            const refund = await stripe.refunds.create({
              payment_intent: bookingData.payment_intent_id,
              amount: paymentAmount,
              reason: 'requested_by_customer',
            });
            
            refundProcessed = true;
            refundId = refund.id;
            
            // Update payments.refunded_cents using actual refund amount from Stripe
            await sql`
              UPDATE payments 
              SET refunded_cents = ${refund.amount || paymentAmount}, updated_at = NOW()
              WHERE id = (
                SELECT id FROM payments 
                WHERE booking_id = ${bookingInternalId} 
                ORDER BY created_at DESC LIMIT 1
              )
            `;
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

        // Get payment amount from payments table
        const paymentRows = await sql`
          SELECT amount_cents FROM payments 
          WHERE booking_id = ${bookingInternalId} 
          ORDER BY created_at DESC LIMIT 1
        `;
        const paymentRow = normalizeRows(paymentRows)[0];
        if (!paymentRow || !paymentRow.amount_cents) {
          return NextResponse.json(
            { error: 'Payment record not found for this booking' },
            { status: 400 }
          );
        }
        const totalCents = paymentRow.amount_cents;
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

        // Update payments.refunded_cents (use subquery for LIMIT in UPDATE)
        await sql`
          UPDATE payments 
          SET refunded_cents = refunded_cents + ${refundCents}, updated_at = NOW()
          WHERE id = (
            SELECT id FROM payments 
            WHERE booking_id = ${bookingInternalId} 
            ORDER BY created_at DESC LIMIT 1
          )
        `;

        // Update booking status to refunded (but do NOT cancel the booking)
        await sql`
          UPDATE bookings
          SET 
            payment_status = 'refunded',
            metadata = jsonb_set(
              jsonb_set(
                jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{refundId}',
                  ${JSON.stringify(refund.id)}::jsonb
                ),
                '{refundedAt}',
                ${JSON.stringify(new Date().toISOString())}::jsonb
              ),
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
              VALUES (${bookingInternalId}, ${'email_sent'}, ${JSON.stringify({ kind: 'booking_refunded' })}::jsonb)
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

