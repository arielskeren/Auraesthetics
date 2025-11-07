import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import axios from 'axios';

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;

// POST /api/admin/bookings/[id]/link-cal-booking - Manually link a booking to a Cal.com booking
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { calBookingId } = body;
    const bookingId = params.id;

    if (!calBookingId) {
      return NextResponse.json(
        { error: 'Cal.com booking ID is required' },
        { status: 400 }
      );
    }

    if (!CAL_COM_API_KEY) {
      return NextResponse.json(
        { error: 'Cal.com API key not configured' },
        { status: 500 }
      );
    }

    const sql = getSqlClient();

    // Get the booking
    const booking = await sql`
      SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1
    `;

    if (!booking || booking.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const bookingData = booking[0];

    // Fetch Cal.com booking details
    try {
      const calResponse = await axios.get(
        `https://api.cal.com/v1/bookings/${calBookingId}`,
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

      const calBooking = calResponse.data.booking || calResponse.data;

      // Update booking with Cal.com data
      await sql`
        UPDATE bookings
        SET 
          cal_booking_id = ${calBookingId},
          booking_date = ${calBooking.startTime ? new Date(calBooking.startTime) : null},
          client_name = ${calBooking.attendees?.[0]?.name || bookingData.client_name || null},
          client_email = ${calBooking.attendees?.[0]?.email || bookingData.client_email || null},
          client_phone = ${calBooking.attendees?.[0]?.phone || bookingData.client_phone || null},
          updated_at = NOW(),
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{manuallyLinked}',
            'true'::jsonb
          ),
          metadata = jsonb_set(
            metadata,
            '{linkedAt}',
            ${JSON.stringify(new Date().toISOString())}::jsonb
          )
        WHERE id = ${bookingId}
      `;

      return NextResponse.json({
        success: true,
        message: 'Booking linked to Cal.com booking successfully',
        booking: {
          id: bookingId,
          calBookingId,
          clientName: calBooking.attendees?.[0]?.name,
          clientEmail: calBooking.attendees?.[0]?.email,
          bookingDate: calBooking.startTime,
        },
      });
    } catch (error: any) {
      console.error('Error fetching Cal.com booking:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch Cal.com booking', 
          details: error.response?.data || error.message 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error linking booking:', error);
    return NextResponse.json(
      { error: 'Failed to link booking', details: error.message },
      { status: 500 }
    );
  }
}

