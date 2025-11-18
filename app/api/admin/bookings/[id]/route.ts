import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import Stripe from 'stripe';
import { cancelBooking as hapioCancelBooking } from '@/lib/hapioClient';
import { deleteOutlookEventForBooking, ensureOutlookEventForBooking } from '@/lib/outlookBookingSync';
import { sendBrevoEmail } from '@/lib/brevoClient';
import { generateBookingCancellationEmail } from '@/lib/emails/bookingCancellation';
// Note: Receipt PDF attachment removed - Stripe sends receipts automatically via email
// when Customer emails → Successful payments / Refunds are enabled in Dashboard

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const OUTLOOK_SYNC_ENABLED = process.env.OUTLOOK_SYNC_ENABLED !== 'false';

// Helper function to check admin authentication
// For GET requests: Skip auth check (page is already protected by AdminPasswordProtection)
// For POST requests: Require token for write operations
function checkAdminAuth(request: NextRequest, requireAuth: boolean = false): boolean {
  // GET requests don't need token (read-only, page already protected)
  if (!requireAuth) {
    return true;
  }
  
  // POST requests require token
  const token = request.nextUrl.searchParams.get('token') || request.headers.get('x-admin-token');
  const expectedToken = process.env.ADMIN_TOKEN || process.env.ADMIN_DIAG_TOKEN;
  
  // In development, allow if no token is set (for easier testing)
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

// Helper to get booking internal ID by any identifier (optimized: single query)
async function getBookingInternalId(sql: any, idOrHapioId: string): Promise<string | null> {
  const result = await sql`
    SELECT id FROM bookings 
    WHERE id = ${idOrHapioId} OR hapio_booking_id = ${idOrHapioId} 
    LIMIT 1
  `;
  const rows = normalizeRows(result);
  return rows[0]?.id || null;
}

// GET /api/admin/bookings/[id] - Get booking details and client history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // No auth check for GET - page is already protected by AdminPasswordProtection
    // GET requests are read-only and less critical

    const sql = getSqlClient();
    const bookingId = params.id;

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    // Get internal ID first (single optimized query)
    const internalId = await getBookingInternalId(sql, bookingId);
    if (!internalId) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Single optimized query: booking + customer + payment + service, parallel history query
    // Replaced subqueries with JOINs for better performance
    const [bookingResult, historyResult] = await Promise.all([
      sql`
        SELECT 
          b.*,
          TRIM(COALESCE(c.first_name || ' ', '') || COALESCE(c.last_name, '')) AS enriched_client_name,
          COALESCE(c.email, b.client_email) AS enriched_client_email,
          COALESCE(c.phone, b.client_phone) AS enriched_client_phone,
          s.name AS service_display_name,
          s.image_url AS service_image_url,
          s.duration_display AS service_duration,
          p.amount_cents AS payment_amount_cents,
          p.status AS payment_status_override,
          p.refunded_cents AS refunded_cents,
          refund_event.data->>'refundId' AS refund_id,
          refund_event.data->>'reason' AS refund_reason,
          refund_event.created_at AS refund_date
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN services s ON (b.service_id = s.id::text OR b.service_id = s.slug)
        LEFT JOIN LATERAL (
          SELECT 
            SUM(amount_cents) AS amount_cents,
            MAX(status) AS status,
            SUM(refunded_cents) AS refunded_cents
          FROM payments
          WHERE booking_id = b.id
        ) p ON true
        LEFT JOIN LATERAL (
          SELECT data, created_at
          FROM booking_events
          WHERE booking_id = b.id AND type = 'refund'
          ORDER BY created_at DESC
          LIMIT 1
        ) refund_event ON true
        WHERE b.id = ${internalId}
        LIMIT 1
      `,
      sql`
        WITH current_booking AS (
          SELECT client_email FROM bookings WHERE id = ${internalId} LIMIT 1
        )
        SELECT 
          b.id, 
          b.service_name, 
          b.booking_date, 
          b.payment_status, 
          b.created_at,
          COALESCE(p.amount_cents, 0) as amount_cents
        FROM bookings b
        CROSS JOIN current_booking cb
        LEFT JOIN LATERAL (
          SELECT amount_cents
          FROM payments
          WHERE booking_id = b.id
          ORDER BY created_at DESC
          LIMIT 1
        ) p ON true
        WHERE b.client_email = cb.client_email
          AND b.id != ${internalId}
        ORDER BY b.created_at DESC 
        LIMIT 5
      `
    ]);
    
    const bookingRows = normalizeRows(bookingResult);
    if (bookingRows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const row = bookingRows[0];
    const paymentAmountCents = row.payment_amount_cents ? Number(row.payment_amount_cents) : null;
    const finalAmount = paymentAmountCents ? paymentAmountCents / 100 : null;
    const refundedCents = row.refunded_cents ? Number(row.refunded_cents) : null;
    const clientHistory = normalizeRows(historyResult).map((h: any) => ({
      id: h.id,
      service_name: h.service_name,
      booking_date: h.booking_date,
      payment_status: h.payment_status,
      created_at: h.created_at,
      final_amount: h.amount_cents ? h.amount_cents / 100 : null,
      payment_type: null,
    }));

    // Use destructuring instead of delete operations (more efficient)
    const {
      enriched_client_name,
      enriched_client_email,
      enriched_client_phone,
      payment_status_override,
      ...restRow
    } = row;

    const bookingData = {
      ...restRow,
      client_name: (enriched_client_name?.trim()) || row.client_name,
      client_email: enriched_client_email || row.client_email,
      client_phone: enriched_client_phone || row.client_phone,
      amount: finalAmount,
      final_amount: finalAmount,
      payment_amount_cents: paymentAmountCents, // Include payment_amount_cents in response
      refunded_cents: refundedCents, // Include refunded_cents in response
      payment_status: payment_status_override || row.payment_status,
      service_display_name: row.service_display_name || row.service_name,
      service_image_url: row.service_image_url,
      service_duration: row.service_duration,
    };

    return NextResponse.json({ success: true, booking: bookingData, clientHistory });
  } catch (error: any) {
    console.error('[Admin Bookings API] Error fetching booking details:', {
      bookingId: params.id,
      error: error.message,
      stack: error.stack,
    });
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
    // No auth check - page is already protected by AdminPasswordProtection
    // Both GET and POST are protected at the page level

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

    if (action === 'force-sync-outlook') {
      // Force sync booking with Outlook calendar
      const sql = getSqlClient();
      const bookingInternalId = await getBookingInternalId(sql, bookingId);
      if (!bookingInternalId) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      if (process.env.OUTLOOK_SYNC_ENABLED === 'false') {
        return NextResponse.json({ error: 'Outlook sync is disabled' }, { status: 400 });
      }

      // Fetch booking data
      const bookingResult = await sql`
        SELECT 
          id, service_id, service_name, client_name, client_email, booking_date, metadata, outlook_event_id
        FROM bookings
        WHERE id = ${bookingInternalId}
        LIMIT 1
      `;
      const bookingRows = normalizeRows(bookingResult);
      if (bookingRows.length === 0) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const bookingData = bookingRows[0];

      try {
        const outlookResult = await ensureOutlookEventForBooking({
          id: bookingInternalId,
          service_id: bookingData.service_id,
          service_name: bookingData.service_name,
          client_name: bookingData.client_name || null,
          client_email: bookingData.client_email || null,
          booking_date: bookingData.booking_date || null,
          outlook_event_id: bookingData.outlook_event_id || null,
          metadata: bookingData.metadata || {},
        });

        // Update booking with Outlook sync status
        await sql`
          UPDATE bookings
          SET 
            outlook_event_id = ${outlookResult.eventId},
            outlook_sync_status = ${outlookResult.action === 'created' ? 'synced' : 'updated'},
            updated_at = NOW()
          WHERE id = ${bookingInternalId}
        `;

        return NextResponse.json({
          success: true,
          message: `Successfully ${outlookResult.action === 'created' ? 'created' : 'updated'} Outlook event`,
          outlookEventId: outlookResult.eventId,
          action: outlookResult.action,
        });
      } catch (outlookError: any) {
        console.error('[Force Sync Outlook] Error:', outlookError);
        
        // Update sync status to error
        await sql`
          UPDATE bookings
          SET 
            outlook_sync_status = 'error',
            updated_at = NOW()
          WHERE id = ${bookingInternalId}
        `;

        return NextResponse.json(
          { error: `Failed to sync with Outlook: ${outlookError?.message || outlookError}` },
          { status: 500 }
        );
      }
    }

    if (action === 'reschedule') {
      // Reschedule booking
      const sql = getSqlClient();
      const bookingInternalId = await getBookingInternalId(sql, bookingId);
      if (!bookingInternalId) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      const { newDate, newTime } = body;
      if (!newDate || !newTime) {
        return NextResponse.json({ error: 'New date and time are required' }, { status: 400 });
      }

      // Parse new date/time and convert to UTC for Hapio
      // Note: Assumes time is in EST/EDT (America/New_York timezone)
      const newDateTime = new Date(`${newDate}T${newTime}`);
      if (isNaN(newDateTime.getTime())) {
        return NextResponse.json({ error: 'Invalid date or time format' }, { status: 400 });
      }

      // Validate date is in the future
      if (newDateTime <= new Date()) {
        return NextResponse.json({ error: 'New date and time must be in the future' }, { status: 400 });
      }

      // Wrap reschedule logic in transaction
      await sql`BEGIN`;
      try {

        // Fetch booking to get service duration and Hapio booking ID
        const bookingResult = await sql`
          SELECT 
            id, hapio_booking_id, service_id, service_name, booking_date, metadata, client_email, client_name
          FROM bookings
          WHERE id = ${bookingInternalId}
          LIMIT 1
        `;
        const bookingRows = normalizeRows(bookingResult);
        if (bookingRows.length === 0) {
          await sql`ROLLBACK`;
          return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }
        const bookingData = bookingRows[0];

        if (!bookingData.hapio_booking_id) {
          await sql`ROLLBACK`;
          return NextResponse.json({ error: 'Booking does not have a Hapio booking ID' }, { status: 400 });
        }

        // Calculate end time (need service duration - fetch from services table)
        let durationMinutes = 60; // Default
        if (bookingData.service_id) {
          const serviceResult = await sql`
            SELECT duration_minutes FROM services
            WHERE id = ${bookingData.service_id} OR slug = ${bookingData.service_id}
            LIMIT 1
          `;
          const serviceRows = normalizeRows(serviceResult);
          if (serviceRows.length > 0 && serviceRows[0].duration_minutes) {
            durationMinutes = Number(serviceRows[0].duration_minutes);
          }
        }

        const newEndDateTime = new Date(newDateTime);
        newEndDateTime.setMinutes(newEndDateTime.getMinutes() + durationMinutes);

        // Update Hapio booking (critical - must succeed)
        // Format dates in Hapio's required format: Y-m-d\TH:i:sP (e.g., 2025-11-18T14:30:00-05:00)
        const { formatDateForHapio } = await import('@/lib/hapioDateUtils');
        const { updateBooking } = await import('@/lib/hapioClient');
        try {
          await updateBooking(bookingData.hapio_booking_id, {
            startsAt: formatDateForHapio(newDateTime),
            endsAt: formatDateForHapio(newEndDateTime),
          });
        } catch (hapioError: any) {
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: `Failed to update booking in Hapio: ${hapioError?.message || hapioError}` },
            { status: 500 }
          );
        }

        // Update Neon booking
        await sql`
          UPDATE bookings
          SET 
            booking_date = ${newDateTime.toISOString()},
            updated_at = NOW(),
            metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{rescheduled_at}',
              ${JSON.stringify(new Date().toISOString())}::jsonb
            )
          WHERE id = ${bookingInternalId}
        `;

        // Commit transaction before non-critical operations
        await sql`COMMIT`;

        // Update Outlook event if it exists (best-effort, after commit)
        if (process.env.OUTLOOK_SYNC_ENABLED !== 'false' && bookingData.metadata?.outlook?.eventId) {
          try {
            const { ensureOutlookEventForBooking } = await import('@/lib/outlookBookingSync');
            await ensureOutlookEventForBooking({
              id: bookingInternalId,
              service_id: bookingData.service_id,
              service_name: bookingData.service_name,
              client_name: bookingData.client_name || bookingData.metadata?.client_name || null,
              client_email: bookingData.client_email || bookingData.metadata?.client_email || null,
              booking_date: newDateTime.toISOString(),
              outlook_event_id: bookingData.metadata.outlook.eventId,
              metadata: bookingData.metadata || {},
            });
          } catch (outlookError) {
            console.error('[Reschedule] Outlook update failed:', outlookError);
            // Non-critical - continue
          }
        }

        // Send reschedule email to customer (best-effort)
        const clientEmail = bookingData.client_email || bookingData.metadata?.client_email || bookingData.metadata?.attendee?.email;
        const clientName = bookingData.client_name || bookingData.metadata?.client_name || bookingData.metadata?.attendee?.name;
        
        if (clientEmail) {
          try {
            // Fetch service details for email
            let serviceImageUrl: string | null = null;
            if (bookingData.service_id) {
              try {
                const serviceResult = await sql`
                  SELECT image_url FROM services
                  WHERE id = ${bookingData.service_id} OR slug = ${bookingData.service_id}
                  LIMIT 1
                `;
                const serviceRows = normalizeRows(serviceResult);
                if (serviceRows.length > 0) {
                  serviceImageUrl = serviceRows[0].image_url || null;
                }
              } catch (e) {
                // Service fetch failure is non-critical
              }
            }

            // Format dates and times
            const oldBookingDate = bookingData.booking_date ? new Date(bookingData.booking_date) : new Date();
            const oldBookingTime = oldBookingDate.toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            const newBookingTime = newDateTime.toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            // Generate reschedule email
            const { generateBookingRescheduleEmail } = await import('@/lib/emails/bookingReschedule');
            const emailHtml = generateBookingRescheduleEmail({
              serviceName: bookingData.service_name || 'Service',
              serviceImageUrl,
              clientName: clientName || null,
              oldBookingDate,
              oldBookingTime,
              newBookingDate: newDateTime,
              newBookingTime,
            });

            await sendBrevoEmail({
              to: [{ email: clientEmail, name: clientName || undefined }],
              subject: `Your ${bookingData.service_name || 'appointment'} has been rescheduled`,
              htmlContent: emailHtml,
              tags: ['booking_rescheduled'],
            });
          } catch (emailError) {
            console.error('[Reschedule] Email send failed:', emailError);
            // Non-critical - continue
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Booking rescheduled successfully',
          booking: {
            ...bookingData,
            booking_date: newDateTime.toISOString(),
          },
        });
      } catch (error: any) {
        // Rollback transaction on any error
        try {
          await sql`ROLLBACK`;
        } catch (rollbackError) {
          console.error('[Reschedule] Rollback failed:', rollbackError);
        }
        console.error('[Reschedule] Error:', error);
        return NextResponse.json(
          { error: 'Failed to reschedule booking', details: error?.message },
          { status: 500 }
        );
      }
    }

    if (action === 'cancel') {
      // Cancel booking
      const sql = getSqlClient();
      const bookingInternalId = await getBookingInternalId(sql, bookingId);
      if (!bookingInternalId) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      
      // Fetch booking data in single optimized query
      const bookingResult = await sql`
        SELECT 
          id, hapio_booking_id, payment_status, payment_intent_id,
          client_email, client_name, service_name, booking_date,
          outlook_event_id, outlook_sync_status, metadata, service_id
        FROM bookings
        WHERE id = ${bookingInternalId}
        LIMIT 1
      `;
      const bookingRows = normalizeRows(bookingResult);
      if (bookingRows.length === 0) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const bookingData = bookingRows[0];

      // Validate booking status - prevent cancelling already cancelled bookings
      if (bookingData.payment_status === 'cancelled') {
        return NextResponse.json(
          { error: 'Booking is already cancelled' },
          { status: 400 }
        );
      }
      // Allow canceling refunded bookings (they can still be cancelled, just won't process another refund)

      let refundProcessed = false;
      let refundId = null;

      const existingMetadata = ensureObject<Record<string, any>>(bookingData.metadata);
      const existingOutlookMeta = ensureObject<Record<string, any>>(existingMetadata.outlook);
      let outlookEventId = bookingData.outlook_event_id ?? existingOutlookMeta.eventId ?? null;
      let outlookSyncStatus = bookingData.outlook_sync_status ?? existingOutlookMeta.status ?? null;
      let outlookLastAttemptAt = existingOutlookMeta.lastAttemptAt ?? null;
      let outlookLastAction = existingOutlookMeta.lastAction ?? null;
      let outlookError = existingOutlookMeta.error ?? null;

      // If booking is paid and NOT already refunded, process refund first (check both 'paid' and 'succeeded')
      const isPaid = (bookingData.payment_status === 'paid' || bookingData.payment_status === 'succeeded') && bookingData.payment_intent_id;
      const isAlreadyRefunded = bookingData.payment_status === 'refunded';
      if (isPaid && !isAlreadyRefunded) {
        // CRITICAL: Wrap refund logic in transaction to prevent race conditions
        await sql`BEGIN`;
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.payment_intent_id);
          
          if (paymentIntent.status === 'succeeded') {
            // CRITICAL: Use SELECT FOR UPDATE to lock payment rows and prevent race conditions
            // Get payment amount from payments table with row-level locking
            const paymentResult = await sql`
              SELECT SUM(amount_cents) as total_amount_cents, SUM(refunded_cents) as total_refunded_cents
              FROM payments 
              WHERE booking_id = ${bookingInternalId}
              FOR UPDATE
            `;
            const paymentRows = normalizeRows(paymentResult);
            if (paymentRows.length === 0 || !paymentRows[0]?.total_amount_cents) {
              await sql`ROLLBACK`;
              throw new Error('Payment record not found for booking');
            }
            const totalPaymentAmount = Number(paymentRows[0].total_amount_cents);
            const totalAlreadyRefunded = Number(paymentRows[0].total_refunded_cents || 0);
            const remainingRefundable = totalPaymentAmount - totalAlreadyRefunded;
            
            // Validate remaining refundable amount
            if (remainingRefundable <= 0) {
              await sql`ROLLBACK`;
              throw new Error('No remaining refundable amount');
            }
            
            // Use remaining refundable amount (full refund on cancellation)
            const requestedRefundAmount = remainingRefundable;
            
            const refund = await stripe.refunds.create({
              payment_intent: bookingData.payment_intent_id,
              amount: requestedRefundAmount,
              reason: 'requested_by_customer',
            });
            
            // CRITICAL: Use Stripe's actual refund amount (may differ from requested)
            const actualRefundAmount = refund.amount || requestedRefundAmount;
            
            // CRITICAL: Re-validate with actual refund amount from Stripe
            if (actualRefundAmount > remainingRefundable) {
              console.error('[Cancel Booking] Stripe refund amount exceeds remaining refundable:', {
                actualRefundAmount,
                remainingRefundable,
                requestedRefundAmount,
              });
              await sql`ROLLBACK`;
              throw new Error('Stripe refund amount exceeds remaining refundable amount');
            }
            
            refundProcessed = true;
            refundId = refund.id;
            
            // Update payments.refunded_cents using actual refund amount from Stripe
            // CRITICAL: Use SELECT FOR UPDATE to lock the row
            const existingPaymentCheck = await sql`
              SELECT id, refunded_cents, amount_cents 
              FROM payments 
              WHERE booking_id = ${bookingInternalId} 
              ORDER BY created_at DESC LIMIT 1
              FOR UPDATE
            `;
            const existingPaymentCheckRows = normalizeRows(existingPaymentCheck);
            if (existingPaymentCheckRows.length > 0) {
              const existing = existingPaymentCheckRows[0];
              const alreadyRefundedOnThisPayment = existing.refunded_cents || 0;
              const newTotalRefundedOnThisPayment = alreadyRefundedOnThisPayment + actualRefundAmount;
              
              // Safety check: ensure we don't exceed this payment record's amount
              if (newTotalRefundedOnThisPayment <= existing.amount_cents) {
                // Also check total across all payments
                const totalRefundedAfter = totalAlreadyRefunded + actualRefundAmount;
                if (totalRefundedAfter <= totalPaymentAmount) {
                  await sql`
                    UPDATE payments 
                    SET refunded_cents = ${newTotalRefundedOnThisPayment}, updated_at = NOW()
                    WHERE id = ${existing.id}
                  `;
                  await sql`COMMIT`;
                } else {
                  await sql`ROLLBACK`;
                  console.error('[Cancel Booking] Refund amount would exceed total payment amount', {
                    totalAlreadyRefunded,
                    actualRefundAmount,
                    totalPayment: totalPaymentAmount,
                  });
                  throw new Error('Refund amount would exceed total payment amount');
                }
              } else {
                await sql`ROLLBACK`;
                console.error('[Cancel Booking] Refund amount would exceed payment record amount', {
                  alreadyRefundedOnThisPayment,
                  actualRefundAmount,
                  paymentRecordAmount: existing.amount_cents,
                });
                throw new Error('Refund amount would exceed payment record amount');
              }
            } else {
              await sql`ROLLBACK`;
              throw new Error('Payment record not found for update');
            }
          } else {
            await sql`ROLLBACK`;
          }
        } catch (error: any) {
          // Rollback transaction on any error
          try {
            await sql`ROLLBACK`;
          } catch (rollbackError) {
            console.error('[Cancel Booking] Rollback failed:', rollbackError);
          }
          // Continue with cancellation even if refund fails (log error)
          console.error('[Cancel Booking] Refund processing failed:', error);
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

      // Send cancellation email with receipt attachment (best-effort)
      if (bookingData.client_email) {
        try {
          // Fetch service details for email
          let serviceImageUrl: string | null = null;
          if (bookingData.service_id) {
            try {
              const serviceResult = await sql`
                SELECT image_url FROM services
                WHERE id = ${bookingData.service_id} OR slug = ${bookingData.service_id}
                LIMIT 1
              `;
              const serviceRows = normalizeRows(serviceResult);
              if (serviceRows.length > 0) {
                serviceImageUrl = serviceRows[0].image_url || null;
              }
            } catch (e) {
              // Service fetch failure is non-critical
            }
          }

          // Format booking date and time
          const bookingDate = bookingData.booking_date ? new Date(bookingData.booking_date) : new Date();
          const bookingTime = bookingDate.toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          // Get refund amount in dollars
          let refundAmount: number | null = null;
          if (refundProcessed && refundId) {
            try {
              const refund = await stripe.refunds.retrieve(refundId);
              refundAmount = refund.amount ? refund.amount / 100 : null;
            } catch (e) {
              // Refund fetch failure is non-critical
            }
          }

          // Generate cancellation email
          // Note: Stripe will automatically send receipt emails separately when Customer emails → Refunds is enabled
           const emailHtml = generateBookingCancellationEmail({
             serviceName: bookingData.service_name || 'Service',
             serviceImageUrl,
             clientName: bookingData.client_name || null,
             bookingDate,
             bookingTime,
             refundProcessed,
             refundAmount,
             refundId: refundId || null,
             receiptUrl: null, // Stripe sends receipts separately
             refundReason: null, // Cancellation doesn't have a reason field
           });

          await sendBrevoEmail({
            to: [{ email: bookingData.client_email, name: bookingData.client_name || undefined }],
            subject: 'Your appointment has been cancelled',
            htmlContent: emailHtml,
            tags: ['booking_cancelled'],
          });
          
          await sql`
            INSERT INTO booking_events (booking_id, type, data)
            VALUES (${bookingInternalId}, ${'email_sent'}, ${JSON.stringify({ kind: 'booking_cancelled', refundProcessed, refundId })}::jsonb)
          `;
        } catch (e) {
          // Email send failure is non-critical
          console.error('[Cancel Booking] Failed to send cancellation email:', e);
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
      const bookingInternalId = await getBookingInternalId(sql, bookingId);
      if (!bookingInternalId) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      
      // Fetch booking data in single optimized query (include all fields needed for Outlook sync and status validation)
      const bookingResult = await sql`
        SELECT 
          id, payment_intent_id, client_email, client_name, service_name,
          service_id, booking_date, outlook_event_id, metadata, payment_status
        FROM bookings
        WHERE id = ${bookingInternalId}
        LIMIT 1
      `;
      const bookingRows = normalizeRows(bookingResult);
      if (bookingRows.length === 0) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      const bookingData = bookingRows[0];

      // Validate booking status - prevent refunding cancelled bookings
      if (bookingData.payment_status === 'cancelled') {
        return NextResponse.json(
          { error: 'Cannot refund a cancelled booking' },
          { status: 400 }
        );
      }

      // Allow partial refunds even if already partially refunded, but check status
      if (bookingData.payment_status === 'refunded') {
        // Check if fully refunded - if so, prevent additional refunds
        // Sum all payments to get accurate total
        const paymentCheck = await sql`
          SELECT SUM(refunded_cents) as total_refunded, SUM(amount_cents) as total_amount
          FROM payments 
          WHERE booking_id = ${bookingInternalId}
        `;
        const paymentCheckRows = normalizeRows(paymentCheck);
        if (paymentCheckRows.length > 0 && paymentCheckRows[0]) {
          const payment = paymentCheckRows[0];
          const totalRefunded = Number(payment.total_refunded || 0);
          const totalAmount = Number(payment.total_amount || 0);
          if (totalRefunded >= totalAmount && totalAmount > 0) {
            return NextResponse.json(
              { error: 'Booking is already fully refunded' },
              { status: 400 }
            );
          }
        }
      }

      if (!bookingData.payment_intent_id) {
        return NextResponse.json(
          { error: 'No payment intent found for this booking' },
          { status: 400 }
        );
      }

      // CRITICAL: Wrap refund logic in transaction to prevent race conditions
      await sql`BEGIN`;
      try {
        const requestedPercent = typeof body?.percentage === 'number' ? body.percentage : null;
        const requestedAmountCents = typeof body?.amountCents === 'number' ? body.amountCents : null;
        const refundReason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
        
        // Reason is required for refunds
        if (!refundReason) {
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: 'Refund reason is required' },
            { status: 400 }
          );
        }

        // Retrieve payment intent
        const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.payment_intent_id);
        
        if (paymentIntent.status !== 'succeeded') {
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: 'Payment not succeeded, cannot refund' },
            { status: 400 }
          );
        }

        // CRITICAL: Use SELECT FOR UPDATE to lock payment rows and prevent race conditions
        // Get payment amount from payments table with row-level locking
        const paymentRows = await sql`
          SELECT SUM(amount_cents) as total_amount_cents, SUM(refunded_cents) as total_refunded_cents
          FROM payments 
          WHERE booking_id = ${bookingInternalId}
          FOR UPDATE
        `;
        const paymentRow = normalizeRows(paymentRows)[0];
        if (!paymentRow || !paymentRow.total_amount_cents) {
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: 'Payment record not found for this booking' },
            { status: 400 }
          );
        }
        const totalCents = Number(paymentRow.total_amount_cents);
        const alreadyRefundedTotal = Number(paymentRow.total_refunded_cents || 0);
        const remainingRefundable = totalCents - alreadyRefundedTotal;
        
        // Calculate refund amount based on request
        let requestedRefundCents = remainingRefundable; // Default to remaining refundable amount
        if (requestedAmountCents && requestedAmountCents > 0 && requestedAmountCents <= remainingRefundable) {
          requestedRefundCents = requestedAmountCents;
        } else if (requestedPercent && requestedPercent > 0 && requestedPercent <= 100) {
          // Calculate percentage of remaining (not yet refunded) amount
          requestedRefundCents = Math.round((requestedPercent / 100) * remainingRefundable);
        }
        
        // Validate refund amount is positive
        if (requestedRefundCents <= 0) {
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: 'Refund amount must be greater than 0' },
            { status: 400 }
          );
        }
        
        // Check if refund would exceed remaining refundable amount
        if (requestedRefundCents > remainingRefundable) {
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: `Refund amount ($${(requestedRefundCents / 100).toFixed(2)}) cannot exceed remaining refundable amount ($${(remainingRefundable / 100).toFixed(2)}). Already refunded: $${(alreadyRefundedTotal / 100).toFixed(2)}` },
            { status: 400 }
          );
        }

        // Create refund with metadata for tracking
        const refund = await stripe.refunds.create({
          payment_intent: bookingData.payment_intent_id,
          amount: requestedRefundCents,
          reason: 'requested_by_customer',
          metadata: {
            booking_id: bookingInternalId,
            refund_reason: refundReason,
            refund_type: requestedPercent ? 'percentage' : 'amount',
            refund_percentage: requestedPercent ? String(requestedPercent) : '',
            refund_amount_cents: String(requestedRefundCents),
          },
        });

        // CRITICAL: Use Stripe's actual refund amount (may differ from requested due to fees/rounding)
        const actualRefundCents = refund.amount || requestedRefundCents;

        // CRITICAL: Re-validate with actual refund amount from Stripe
        if (actualRefundCents > remainingRefundable) {
          // This should never happen, but if it does, we need to handle it
          console.error('[Refund] Stripe refund amount exceeds remaining refundable:', {
            actualRefundCents,
            remainingRefundable,
            requestedRefundCents,
          });
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: `Stripe refund amount ($${(actualRefundCents / 100).toFixed(2)}) exceeds remaining refundable amount. Please contact support.` },
            { status: 500 }
          );
        }

        // Update payments.refunded_cents across all payment records for this booking
        // Distribute refund proportionally or to the most recent payment
        // For simplicity, we'll add to the most recent payment record
        // CRITICAL: Use SELECT FOR UPDATE to lock the row
        const existingRefundCheck = await sql`
          SELECT id, refunded_cents, amount_cents 
          FROM payments 
          WHERE booking_id = ${bookingInternalId} 
          ORDER BY created_at DESC 
          LIMIT 1
          FOR UPDATE
        `;
        const existingRefundCheckRows = normalizeRows(existingRefundCheck);
        if (existingRefundCheckRows.length === 0) {
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: 'Payment record not found for this booking' },
            { status: 400 }
          );
        }
        const existingRefund = existingRefundCheckRows[0];
        const alreadyRefundedOnThisPayment = existingRefund.refunded_cents || 0;
        const newTotalRefundedOnThisPayment = alreadyRefundedOnThisPayment + actualRefundCents;
        
        // Safety check: ensure we don't refund more than this payment record's amount
        if (newTotalRefundedOnThisPayment > existingRefund.amount_cents) {
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: `Cannot refund $${(actualRefundCents / 100).toFixed(2)}. Would exceed this payment record's amount. Payment: $${(existingRefund.amount_cents / 100).toFixed(2)}, Already refunded on this payment: $${(alreadyRefundedOnThisPayment / 100).toFixed(2)}` },
            { status: 400 }
          );
        }
        
        // Final safety check: ensure total refunded across all payments doesn't exceed total paid
        const newTotalRefundedAcrossAll = alreadyRefundedTotal + actualRefundCents;
        if (newTotalRefundedAcrossAll > totalCents) {
          await sql`ROLLBACK`;
          return NextResponse.json(
            { error: `Cannot refund $${(actualRefundCents / 100).toFixed(2)}. Total refunded across all payments would exceed total paid. Total paid: $${(totalCents / 100).toFixed(2)}, Already refunded: $${(alreadyRefundedTotal / 100).toFixed(2)}` },
            { status: 400 }
          );
        }
        
        await sql`
          UPDATE payments 
          SET refunded_cents = ${newTotalRefundedOnThisPayment}, updated_at = NOW()
          WHERE id = ${existingRefund.id}
        `;

        // Update booking status to refunded (but do NOT cancel the booking)
        await sql`
          UPDATE bookings
          SET 
            payment_status = 'refunded',
            metadata = jsonb_set(
              jsonb_set(
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
                ${JSON.stringify(actualRefundCents)}::jsonb
              ),
              '{refundReason}',
              ${JSON.stringify(refundReason)}::jsonb
            ),
            updated_at = NOW()
          WHERE id = ${bookingInternalId}
        `;

        // Record event with reason and full refund details (use actual refund amount from Stripe)
        await sql`
          INSERT INTO booking_events (booking_id, type, data)
          VALUES (${bookingInternalId}, ${'refund'}, ${JSON.stringify({ 
            refundId: refund.id, 
            amount_cents: actualRefundCents, 
            requested_amount_cents: requestedRefundCents,
            reason: refundReason,
            refund_type: requestedPercent ? 'percentage' : 'amount',
            refund_percentage: requestedPercent || null,
            total_refunded_cents: newTotalRefundedAcrossAll,
            total_payment_cents: totalCents,
            already_refunded_before: alreadyRefundedTotal,
            refunded_on_this_payment: newTotalRefundedOnThisPayment,
            payment_record_id: existingRefund.id,
          })}::jsonb)
        `;

        // Commit transaction before external API calls (best-effort operations)
        await sql`COMMIT`;

        // Update Outlook event if it exists (best-effort)
        if (process.env.OUTLOOK_SYNC_ENABLED !== 'false' && bookingData.outlook_event_id) {
          try {
            const bookingForOutlook = {
              id: bookingInternalId,
              service_id: bookingData.service_id,
              service_name: bookingData.service_name,
              client_name: bookingData.client_name,
              client_email: bookingData.client_email,
              booking_date: bookingData.booking_date,
              outlook_event_id: bookingData.outlook_event_id,
              metadata: bookingData.metadata || {},
            };
            await ensureOutlookEventForBooking(bookingForOutlook);
            await sql`
              UPDATE bookings 
              SET outlook_sync_status = 'updated', updated_at = NOW()
              WHERE id = ${bookingInternalId}
            `;
          } catch (outlookError) {
            console.error('[Refund Booking] Outlook update failed:', outlookError);
            // Update sync status to reflect failure
            try {
              await sql`
                UPDATE bookings 
                SET outlook_sync_status = 'error', updated_at = NOW()
                WHERE id = ${bookingInternalId}
              `;
            } catch (updateError) {
              console.error('[Refund Booking] Failed to update Outlook sync status:', updateError);
            }
          }
        }

        // Send refund email (best-effort)
        // Note: Stripe will automatically send receipt emails separately when Customer emails → Refunds is enabled
        if (bookingData.client_email) {
          try {
            // Generate cancellation email (refund is similar to cancellation)
            const bookingDate = bookingData.booking_date ? new Date(bookingData.booking_date) : new Date();
            const bookingTime = bookingDate.toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            // Fetch service image
            let serviceImageUrl: string | null = null;
            if (bookingData.service_id) {
              try {
                const serviceResult = await sql`
                  SELECT image_url FROM services
                  WHERE id = ${bookingData.service_id} OR slug = ${bookingData.service_id}
                  LIMIT 1
                `;
                const serviceRows = normalizeRows(serviceResult);
                if (serviceRows.length > 0) {
                  serviceImageUrl = serviceRows[0].image_url || null;
                }
              } catch (e) {
                // Service fetch failure is non-critical
              }
            }

            const emailHtml = generateBookingCancellationEmail({
              serviceName: bookingData.service_name || 'Service',
              serviceImageUrl,
              clientName: bookingData.client_name || null,
              bookingDate,
              bookingTime,
              refundProcessed: true,
              refundAmount: actualRefundCents / 100,
              refundId: refund.id,
              receiptUrl: null, // Stripe sends receipts separately
              refundReason: refundReason,
            });

            await sendBrevoEmail({
              to: [{ email: bookingData.client_email, name: bookingData.client_name || undefined }],
              subject: 'Your refund has been issued',
              htmlContent: emailHtml,
              tags: ['booking_refunded'],
            });
            await sql`
              INSERT INTO booking_events (booking_id, type, data)
              VALUES (${bookingInternalId}, ${'email_sent'}, ${JSON.stringify({ kind: 'booking_refunded', refundId: refund.id })}::jsonb)
            `;
          } catch (e) {
            // Email send failure is non-critical
            console.error('[Refund] Failed to send refund email:', e);
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Refund processed successfully. Booking remains active (not cancelled).',
          refundId: refund.id,
          refundAmount: actualRefundCents / 100,
        });
      } catch (error: any) {
        // Rollback transaction on error
        try {
          await sql`ROLLBACK`;
        } catch (rollbackError) {
          console.error('[Refund] Failed to rollback transaction:', rollbackError);
        }
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

