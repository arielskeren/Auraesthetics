import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import axios from 'axios';

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

// Cancel unauthorized Cal.com bookings (bookings without valid payment)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { calBookingId, reason } = body;

    if (!calBookingId) {
      return NextResponse.json(
        { error: 'Cal.com booking ID is required' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    // Check if booking has valid payment
    const booking = await sql`
      SELECT * FROM bookings 
      WHERE cal_booking_id = ${calBookingId}
      LIMIT 1
    `;

    const bookingRows = normalizeRows(booking);

    if (bookingRows.length === 0) {
      // Booking doesn't exist in our database - likely unauthorized
      // Try to cancel via Cal.com API
      try {
        const cancelResponse = await axios.post(
          `https://api.cal.com/v1/bookings/${calBookingId}/cancel`,
          {
            reason: reason || 'Unauthorized booking - no payment found',
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

        return NextResponse.json({
          success: true,
          cancelled: true,
          message: 'Booking cancelled via Cal.com API',
          calBookingId,
        });
      } catch (error: any) {
        console.error('Error cancelling booking:', error.response?.data || error.message);
        return NextResponse.json(
          { error: 'Failed to cancel booking', details: error.response?.data || error.message },
          { status: 500 }
        );
      }
    }

    const bookingData = bookingRows[0];

    // Check if booking has valid payment
    if (!bookingData.payment_intent_id || !bookingData.metadata?.bookingToken) {
      // No valid payment - cancel the booking
      try {
        const cancelResponse = await axios.post(
          `https://api.cal.com/v1/bookings/${calBookingId}/cancel`,
          {
            reason: reason || 'Unauthorized booking - no valid payment found',
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

        // Update booking status
        await sql`
          UPDATE bookings 
          SET 
            payment_status = 'cancelled',
            updated_at = NOW()
          WHERE cal_booking_id = ${calBookingId}
        `;

        return NextResponse.json({
          success: true,
          cancelled: true,
          message: 'Unauthorized booking cancelled',
          calBookingId,
        });
      } catch (error: any) {
        console.error('Error cancelling booking:', error.response?.data || error.message);
        return NextResponse.json(
          { error: 'Failed to cancel booking' },
          { status: 500 }
        );
      }
    }

    // Booking has valid payment - don't cancel
    return NextResponse.json({
      success: true,
      cancelled: false,
      message: 'Booking has valid payment - not cancelled',
      calBookingId,
    });
  } catch (error: any) {
    console.error('Cancel booking error:', error);
    return NextResponse.json(
      { error: 'Failed to process cancellation request' },
      { status: 500 }
    );
  }
}

