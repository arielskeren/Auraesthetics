import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

// Helper function to check admin authentication
// GET requests: Skip auth check (page is already protected by AdminPasswordProtection)
// POST requests: Require token for write operations
function checkAdminAuth(request: NextRequest, requireAuth: boolean = false): boolean {
  // GET requests don't need token (read-only, page already protected)
  if (!requireAuth) {
    return true;
  }
  
  // POST requests require token
  const token = request.nextUrl.searchParams.get('token') || request.headers.get('x-admin-token');
  const expectedToken = process.env.ADMIN_TOKEN || process.env.ADMIN_DIAG_TOKEN;
  
  // In development, allow if no token is set (for easier testing)
  if (process.env.NODE_ENV === 'development' && !expectedToken) {
    return true;
  }
  
  return token === expectedToken;
}

// GET /api/admin/bookings - Fetch all bookings
export async function GET(request: NextRequest) {
  try {
    // No auth check for GET - page is already protected by AdminPasswordProtection
    // GET requests are read-only and less critical

    const sql = getSqlClient();

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
      LEFT JOIN (
        SELECT booking_id, amount_cents
        FROM (
          SELECT booking_id, amount_cents,
                 ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY created_at DESC) as rn
          FROM payments
        ) ranked
        WHERE rn = 1
      ) p ON p.booking_id = b.id
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

