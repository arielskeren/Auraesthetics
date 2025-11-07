import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// Verify booking token and return booking details
// This endpoint can be used to validate tokens before allowing Cal.com access
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const paymentIntentId = searchParams.get('paymentIntentId');

    if (!token && !paymentIntentId) {
      return NextResponse.json(
        { error: 'Token or payment intent ID is required' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    // Find booking by token or payment intent
    let booking;
    if (token) {
      const result = await sql`
        SELECT * FROM bookings 
        WHERE metadata->>'bookingToken' = ${token}
        LIMIT 1
      `;
      booking = result[0];
    } else if (paymentIntentId) {
      const result = await sql`
        SELECT * FROM bookings 
        WHERE payment_intent_id = ${paymentIntentId}
        LIMIT 1
      `;
      booking = result[0];
    }

    if (!booking) {
      return NextResponse.json(
        { error: 'Invalid booking token', valid: false },
        { status: 404 }
      );
    }

    // Check if token is expired
    const tokenExpiresAt = booking.metadata?.tokenExpiresAt;
    const isExpired = tokenExpiresAt && new Date(tokenExpiresAt) < new Date();

    // Verify payment status
    let paymentValid = false;
    if (booking.payment_intent_id) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        const validStatuses = ['succeeded', 'requires_capture', 'processing'];
        paymentValid = validStatuses.includes(paymentIntent.status);
      } catch (error) {
        console.error('Error verifying payment:', error);
      }
    }

    // Check if already booked
    const isBooked = booking.cal_booking_id !== null;

    return NextResponse.json({
      valid: !isExpired && paymentValid && !isBooked,
      expired: isExpired,
      paymentValid,
      isBooked,
      booking: {
        id: booking.id,
        serviceName: booking.service_name,
        serviceId: booking.service_id,
        amount: booking.amount,
        finalAmount: booking.final_amount,
        paymentStatus: booking.payment_status,
        paymentType: booking.metadata?.paymentType || 'full',
        paymentIntentId: booking.payment_intent_id,
        expiresAt: tokenExpiresAt,
      },
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify token', valid: false },
      { status: 500 }
    );
  }
}

