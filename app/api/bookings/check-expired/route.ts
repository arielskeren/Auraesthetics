import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

// Check for expired tokens without bookings
// This endpoint can be called periodically (cron job) or manually
export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();

    // Find bookings with expired tokens that haven't been booked yet
    const expiredBookings = await sql`
      SELECT 
        id,
        service_name,
        client_email,
        amount,
        final_amount,
        payment_status,
        payment_intent_id,
        metadata->>'bookingToken' as booking_token,
        metadata->>'tokenExpiresAt' as token_expires_at,
        created_at,
        updated_at
      FROM bookings
      WHERE 
        metadata->>'bookingToken' IS NOT NULL
        AND metadata->>'tokenExpiresAt' IS NOT NULL
        AND (metadata->>'tokenExpiresAt')::timestamp < NOW()
        AND cal_booking_id IS NULL
        AND payment_status IN ('paid', 'authorized', 'processing')
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      expiredCount: expiredBookings.length,
      expiredBookings: expiredBookings,
    });
  } catch (error: any) {
    console.error('Error checking expired tokens:', error);
    return NextResponse.json(
      { error: 'Failed to check expired tokens' },
      { status: 500 }
    );
  }
}

// Mark expired tokens as expired and send notifications
export async function POST(request: NextRequest) {
  try {
    const sql = getSqlClient();

    // Find and mark expired bookings
    const result = await sql`
      UPDATE bookings
      SET 
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{tokenExpired}',
          'true'::jsonb
        ),
        updated_at = NOW()
      WHERE 
        metadata->>'bookingToken' IS NOT NULL
        AND metadata->>'tokenExpiresAt' IS NOT NULL
        AND (metadata->>'tokenExpiresAt')::timestamp < NOW()
        AND cal_booking_id IS NULL
        AND payment_status IN ('paid', 'authorized', 'processing')
        AND (metadata->>'tokenExpired')::boolean IS NOT TRUE
      RETURNING 
        id,
        service_name,
        client_email,
        amount,
        final_amount,
        payment_status,
        payment_intent_id,
        metadata
    `;

    // Get the updated bookings for notification
    const expiredBookings = result.map((booking: any) => ({
      id: booking.id,
      serviceName: booking.service_name,
      clientEmail: booking.client_email,
      amount: booking.amount,
      finalAmount: booking.final_amount,
      paymentStatus: booking.payment_status,
      paymentIntentId: booking.payment_intent_id,
      expiresAt: booking.metadata?.tokenExpiresAt,
    }));

    return NextResponse.json({
      markedExpired: expiredBookings.length,
      expiredBookings: expiredBookings,
    });
  } catch (error: any) {
    console.error('Error marking expired tokens:', error);
    return NextResponse.json(
      { error: 'Failed to mark expired tokens' },
      { status: 500 }
    );
  }
}

