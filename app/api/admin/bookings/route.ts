import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

// GET /api/admin/bookings - Fetch all bookings
export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();

    // TODO: Add authentication/authorization check here
    // For now, this is a basic implementation
    // In production, add proper admin authentication

    const bookings = await sql`
      SELECT 
        id,
        cal_booking_id,
        service_id,
        service_name,
        client_name,
        client_email,
        client_phone,
        booking_date,
        COALESCE(amount, 0)::numeric as amount,
        COALESCE(deposit_amount, 0)::numeric as deposit_amount,
        COALESCE(final_amount, amount, 0)::numeric as final_amount,
        discount_code,
        COALESCE(discount_amount, 0)::numeric as discount_amount,
        payment_type,
        payment_status,
        payment_intent_id,
        created_at,
        updated_at
      FROM bookings
      ORDER BY created_at DESC
    `;

    const bookingRows: any[] = Array.isArray(bookings)
      ? bookings
      : (bookings as any)?.rows ?? [];

    return NextResponse.json({
      success: true,
      bookings: bookingRows,
      count: bookingRows.length,
    });
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings', details: error.message },
      { status: 500 }
    );
  }
}

