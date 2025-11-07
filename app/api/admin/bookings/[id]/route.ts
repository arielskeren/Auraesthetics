import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import Stripe from 'stripe';
import axios from 'axios';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

// GET /api/admin/bookings/[id] - Get booking details and client history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const bookingId = params.id;

    // Get booking details
    const booking = await sql`
      SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1
    `;

    const bookingRows = normalizeRows(booking);
    if (bookingRows.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const bookingData = bookingRows[0];

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
      const booking = await sql`
        SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1
      `;

      const bookingRows = normalizeRows(booking);
      if (bookingRows.length === 0) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      const bookingData = bookingRows[0];

      let refundProcessed = false;
      let refundId = null;

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

      // Cancel in Cal.com if booking ID exists
      if (bookingData.cal_booking_id && CAL_COM_API_KEY) {
        try {
          const cancelResponse = await axios.post(
            `https://api.cal.com/v1/bookings/${bookingData.cal_booking_id}/cancel`,
            {
              reason: 'Cancelled by admin',
            },
            {
              headers: {
                'Authorization': `Bearer ${CAL_COM_API_KEY}`,
                'Content-Type': 'application/json',
              },
              params: {
                apiKey: CAL_COM_API_KEY,
              },
            }
          );
          console.log('✅ Cal.com booking cancelled:', cancelResponse.data);
        } catch (error: any) {
          console.error('⚠️  Error cancelling Cal.com booking:', error.response?.data || error.message);
          // Continue with local cancellation even if Cal.com fails
        }
      }

      // Update booking status to cancelled (not refunded, since refund is just part of cancellation)
      let updatedMetadata: any = {
        ...(bookingData.metadata || {}),
        cancelledAt: new Date().toISOString(),
      };
      
      if (refundProcessed && refundId) {
        updatedMetadata.refundId = refundId;
      }
      
      await sql`
        UPDATE bookings
        SET 
          payment_status = 'cancelled',
          metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
          updated_at = NOW()
        WHERE id = ${bookingId}
      `;

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
      const booking = await sql`
        SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1
      `;

      const bookingRows = normalizeRows(booking);
      if (bookingRows.length === 0) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      const bookingData = bookingRows[0];

      if (!bookingData.payment_intent_id) {
        return NextResponse.json(
          { error: 'No payment intent found for this booking' },
          { status: 400 }
        );
      }

      try {
        // Retrieve payment intent
        const paymentIntent = await stripe.paymentIntents.retrieve(bookingData.payment_intent_id);
        
        if (paymentIntent.status !== 'succeeded') {
          return NextResponse.json(
            { error: 'Payment not succeeded, cannot refund' },
            { status: 400 }
          );
        }

        // Create refund
        const refund = await stripe.refunds.create({
          payment_intent: bookingData.payment_intent_id,
          amount: Math.round((Number(bookingData.final_amount) || 0) * 100), // Convert to cents
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
            updated_at = NOW()
          WHERE id = ${bookingId}
        `;

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

