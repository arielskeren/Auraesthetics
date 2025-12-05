import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

// Stripe SDK - kept for historical booking verification
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-10-29.clover' as any })
  : null;

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

    // Find booking by token, payment intent, or transaction ID
    let booking;
    if (token) {
      const result = await sql`
        SELECT *, magicpay_transaction_id, magicpay_auth_code FROM bookings 
        WHERE metadata->>'bookingToken' = ${token}
        LIMIT 1
      `;
      booking = normalizeRows(result)[0];
    } else if (paymentIntentId) {
      // Check if paymentIntentId is a Stripe PI ID or MagicPay transaction ID
      const result = await sql`
        SELECT *, magicpay_transaction_id, magicpay_auth_code FROM bookings 
        WHERE payment_intent_id = ${paymentIntentId}
           OR magicpay_transaction_id = ${paymentIntentId}
        LIMIT 1
      `;
      booking = normalizeRows(result)[0];
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
    
    // Check if this is a MagicPay booking
    if (booking.magicpay_transaction_id) {
      // MagicPay bookings are already paid (payment happens synchronously)
      paymentValid = ['succeeded', 'paid'].includes(booking.payment_status);
    } else if (booking.payment_intent_id && stripe) {
      // Legacy Stripe booking - verify with Stripe
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        const validStatuses = ['succeeded', 'requires_capture', 'processing'];
        paymentValid = validStatuses.includes(paymentIntent.status);
      } catch (error) {
        console.error('Error verifying Stripe payment:', error);
      }
    }

    const hapioStatus = booking.metadata?.hapio?.status ?? null;
    const isBooked = booking.hapio_booking_id !== null && hapioStatus !== 'cancelled';

    return NextResponse.json({
      valid: !isExpired && paymentValid && !isBooked,
      expired: isExpired,
      paymentValid,
      isBooked,
      booking: {
        id: booking.id,
        serviceName: booking.service_name,
        serviceId: booking.service_id,
        hapioBookingId: booking.hapio_booking_id,
        hapioStatus,
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

