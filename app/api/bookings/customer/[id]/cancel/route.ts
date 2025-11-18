import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import Stripe from 'stripe';
import { cancelBooking as hapioCancelBooking } from '@/lib/hapioClient';
import { deleteOutlookEventForBooking } from '@/lib/outlookBookingSync';
import { sendBrevoEmail } from '@/lib/brevoClient';
import { generateBookingCancellationEmail } from '@/lib/emails/bookingCancellation';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

export const dynamic = 'force-dynamic';

// POST /api/bookings/customer/[id]/cancel - Customer-facing cancellation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id;
    const sql = getSqlClient();

    // Fetch booking
    const bookingResult = await sql`
      SELECT 
        id, hapio_booking_id, payment_status, payment_intent_id,
        client_email, client_name, service_name, booking_date,
        outlook_event_id, outlook_sync_status, metadata, service_id
      FROM bookings
      WHERE id = ${bookingId} OR hapio_booking_id = ${bookingId}
      LIMIT 1
    `;
    const bookingRows = normalizeRows(bookingResult);
    if (bookingRows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    const bookingData = bookingRows[0];

    // Validate booking can be cancelled
    if (bookingData.payment_status === 'cancelled') {
      return NextResponse.json(
        { error: 'Booking is already cancelled' },
        { status: 400 }
      );
    }

    let refundProcessed = false;
    let refundId = null;

    // If booking is paid, process refund
    const isPaid = (bookingData.payment_status === 'paid' || bookingData.payment_status === 'succeeded') && bookingData.payment_intent_id;
    const isAlreadyRefunded = bookingData.payment_status === 'refunded';
    
    if (isPaid && !isAlreadyRefunded) {
      // Wrap refund logic in transaction
      await sql`BEGIN`;
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.payment_intent_id);
        
        if (paymentIntent.status === 'succeeded') {
          // Get payment amount with row-level locking
          const paymentResult = await sql`
            SELECT SUM(amount_cents) as total_amount_cents, SUM(refunded_cents) as total_refunded_cents
            FROM payments 
            WHERE booking_id = ${bookingData.id}
            FOR UPDATE
          `;
          const paymentRows = normalizeRows(paymentResult);
          if (paymentRows.length > 0 && paymentRows[0]?.total_amount_cents) {
            const totalPaymentAmount = Number(paymentRows[0].total_amount_cents);
            const totalAlreadyRefunded = Number(paymentRows[0].total_refunded_cents || 0);
            const remainingRefundable = totalPaymentAmount - totalAlreadyRefunded;
            
            if (remainingRefundable > 0) {
              const refund = await stripe.refunds.create({
                payment_intent: bookingData.payment_intent_id,
                amount: remainingRefundable,
                reason: 'requested_by_customer',
              });
              
              const actualRefundAmount = refund.amount || remainingRefundable;
              
              if (actualRefundAmount > remainingRefundable) {
                await sql`ROLLBACK`;
                throw new Error('Stripe refund amount exceeds remaining refundable amount');
              }
              
              refundProcessed = true;
              refundId = refund.id;
              
              // Update payments.refunded_cents
              const existingPaymentCheck = await sql`
                SELECT id, refunded_cents, amount_cents 
                FROM payments 
                WHERE booking_id = ${bookingData.id} 
                ORDER BY created_at DESC LIMIT 1
                FOR UPDATE
              `;
              const existingPaymentCheckRows = normalizeRows(existingPaymentCheck);
              if (existingPaymentCheckRows.length > 0) {
                const existing = existingPaymentCheckRows[0];
                const alreadyRefundedOnThisPayment = existing.refunded_cents || 0;
                const newTotalRefundedOnThisPayment = alreadyRefundedOnThisPayment + actualRefundAmount;
                
                if (newTotalRefundedOnThisPayment <= existing.amount_cents) {
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
                    throw new Error('Refund amount would exceed total payment amount');
                  }
                } else {
                  await sql`ROLLBACK`;
                  throw new Error('Refund amount would exceed payment record amount');
                }
              } else {
                await sql`ROLLBACK`;
                throw new Error('Payment record not found for update');
              }
            }
          }
        } else {
          await sql`ROLLBACK`;
        }
      } catch (error: any) {
        try {
          await sql`ROLLBACK`;
        } catch (rollbackError) {
          console.error('[Customer Cancel] Rollback failed:', rollbackError);
        }
        console.error('[Customer Cancel] Refund processing failed:', error);
        // Continue with cancellation even if refund fails
      }
    }

    // Cancel in Hapio
    if (bookingData.hapio_booking_id) {
      try {
        await hapioCancelBooking(bookingData.hapio_booking_id);
      } catch (error: any) {
        console.error('[Customer Cancel] Hapio cancel failed:', error);
        // Continue even if Hapio cancel fails
      }
    }

    // Delete Outlook event if it exists
    if (process.env.OUTLOOK_SYNC_ENABLED !== 'false' && bookingData.outlook_event_id) {
      try {
        await deleteOutlookEventForBooking({
          id: bookingData.id,
          service_id: bookingData.service_id ?? null,
          service_name: bookingData.service_name ?? null,
          client_name: bookingData.client_name ?? null,
          client_email: bookingData.client_email ?? null,
          metadata: bookingData.metadata || {},
          booking_date: bookingData.booking_date ?? null,
          outlook_event_id: bookingData.outlook_event_id,
        });
      } catch (outlookError) {
        console.error('[Customer Cancel] Outlook delete failed:', outlookError);
      }
    }

    // Update booking status
    const existingMetadata = bookingData.metadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'customer',
    };
    
    if (refundProcessed && refundId) {
      updatedMetadata.refundId = refundId;
    }
    
    await sql`
      UPDATE bookings
      SET 
        payment_status = 'cancelled',
        outlook_event_id = ${null},
        outlook_sync_status = ${'cancelled'},
        metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
        updated_at = NOW()
      WHERE id = ${bookingData.id}
    `;

    // Record event
    await sql`
      INSERT INTO booking_events (booking_id, type, data)
      VALUES (${bookingData.id}, ${'cancelled'}, ${JSON.stringify({ refundProcessed, refundId, cancelledBy: 'customer' })}::jsonb)
    `;

    // Send cancellation email
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
            // Non-critical
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

        // Get refund amount
        let refundAmount: number | null = null;
        if (refundProcessed && refundId) {
          try {
            const refund = await stripe.refunds.retrieve(refundId);
            refundAmount = refund.amount ? refund.amount / 100 : null;
          } catch (e) {
            // Non-critical
          }
        }

        // Generate cancellation email
        const emailHtml = generateBookingCancellationEmail({
          serviceName: bookingData.service_name || 'Service',
          serviceImageUrl,
          clientName: bookingData.client_name || null,
          bookingDate,
          bookingTime,
          refundProcessed,
          refundAmount,
          refundId: refundId || null,
          receiptUrl: null,
          refundReason: 'Cancelled by customer',
        });

        await sendBrevoEmail({
          to: [{ email: bookingData.client_email, name: bookingData.client_name || undefined }],
          subject: 'Your appointment has been cancelled',
          htmlContent: emailHtml,
          tags: ['booking_cancelled'],
        });
      } catch (emailError) {
        console.error('[Customer Cancel] Email send failed:', emailError);
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
  } catch (error: any) {
    console.error('[Customer Cancel] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking', details: error?.message },
      { status: 500 }
    );
  }
}

