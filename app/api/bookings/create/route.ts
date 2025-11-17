import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      calBookingId,
      hapioBookingId,
      serviceId,
      serviceName,
      clientName,
      clientEmail,
      clientPhone,
      bookingDate,
      amount,
      depositAmount,
      finalAmount,
      discountCode,
      discountAmount,
      paymentStatus,
      paymentIntentId,
      paymentMethodId,
      metadata,
    } = body;

    // Validate required fields (amount validation removed - stored in payments table)
    if (!serviceId || !serviceName || !clientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceId, serviceName, clientEmail' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    // Insert booking record (removed dropped columns: cal_booking_id, amount, deposit_amount, final_amount, discount_code, discount_amount, payment_method_id)
    const result = await sql`
      INSERT INTO bookings (
        hapio_booking_id,
        service_id,
        service_name,
        client_name,
        client_email,
        client_phone,
        booking_date,
        payment_status,
        payment_intent_id,
        metadata
      ) VALUES (
        ${hapioBookingId || null},
        ${serviceId},
        ${serviceName},
        ${clientName || null},
        ${clientEmail},
        ${clientPhone || null},
        ${bookingDate ? new Date(bookingDate) : null},
        ${paymentStatus || 'pending'},
        ${paymentIntentId || null},
        ${metadata ? JSON.stringify(metadata) : null}
      )
      RETURNING id, created_at
    `;

    const bookingRows = normalizeRows(result);
    const booking = bookingRows[0];

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        hapioBookingId,
        serviceId,
        serviceName,
        clientEmail,
        paymentStatus: paymentStatus || 'pending',
        createdAt: booking.created_at,
      },
    });
  } catch (error: any) {
    console.error('Booking creation error:', error);
    
    // Handle duplicate booking ID error
    if (error.message && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Booking with this identifier already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}


