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
        b.id,
        b.hapio_booking_id,
        b.outlook_event_id,
        b.outlook_sync_status,
        b.service_id,
        b.service_name,
        b.client_name,
        b.client_email,
        b.client_phone,
        b.booking_date,
        b.payment_status,
        b.payment_intent_id,
        b.metadata,
        b.created_at,
        b.updated_at,
        COALESCE(p.amount_cents, 0)::numeric / 100.0 as amount,
        COALESCE(p.amount_cents, 0)::numeric / 100.0 as final_amount,
        0::numeric as deposit_amount,
        NULL::text as discount_code,
        0::numeric as discount_amount,
        NULL::text as payment_type,
        NULL::text as cal_booking_id
      FROM bookings b
      LEFT JOIN LATERAL (
        SELECT amount_cents FROM payments 
        WHERE payments.booking_id = b.id 
        ORDER BY payments.created_at DESC 
        LIMIT 1
      ) p ON true
      ORDER BY b.created_at DESC
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

