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

export const dynamic = 'force-dynamic';

// GET /api/admin/customers/[id]/bookings - Get booking history for a customer
// Returns up to 10 bookings OR all bookings from last 12 months, whichever is greater
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const customerId = params.id;

    // Get customer email for fallback lookup
    const customerResult = await sql`
      SELECT email FROM customers WHERE id = ${customerId} LIMIT 1
    `;
    const customer = normalizeRows(customerResult)[0];
    const customerEmail = customer?.email;

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Calculate date 12 months ago
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Fetch all bookings from last 12 months
    const twelveMonthsBookingsResult = await sql`
      SELECT 
        b.id,
        b.booking_date,
        b.service_name,
        b.payment_status,
        b.created_at,
        b.hapio_booking_id,
        COALESCE(
          (
            SELECT SUM(p.amount_cents) - COALESCE(SUM(p.refunded_cents), 0)
            FROM payments p
            WHERE p.booking_id = b.id
              AND p.status = 'succeeded'
          ),
          0
        ) as total_paid_cents
      FROM bookings b
      WHERE (
        b.customer_id = ${customerId}
        OR LOWER(b.client_email) = LOWER(${customerEmail})
      )
        AND b.booking_date >= ${twelveMonthsAgo.toISOString()}
        AND b.payment_status IN ('paid', 'completed')
      ORDER BY b.booking_date DESC
    `;

    const twelveMonthsBookings = normalizeRows(twelveMonthsBookingsResult);

    // Fetch last 10 bookings (regardless of date)
    const lastTenBookingsResult = await sql`
      SELECT 
        b.id,
        b.booking_date,
        b.service_name,
        b.payment_status,
        b.created_at,
        b.hapio_booking_id,
        COALESCE(
          (
            SELECT SUM(p.amount_cents) - COALESCE(SUM(p.refunded_cents), 0)
            FROM payments p
            WHERE p.booking_id = b.id
              AND p.status = 'succeeded'
          ),
          0
        ) as total_paid_cents
      FROM bookings b
      WHERE (
        b.customer_id = ${customerId}
        OR LOWER(b.client_email) = LOWER(${customerEmail})
      )
        AND b.payment_status IN ('paid', 'completed')
      ORDER BY b.booking_date DESC
      LIMIT 10
    `;

    const lastTenBookings = normalizeRows(lastTenBookingsResult);

    // Use whichever gives more bookings (12 months or last 10)
    // Create a map to deduplicate by booking ID
    const bookingsMap = new Map();
    
    // Add 12 months bookings first
    twelveMonthsBookings.forEach((b: any) => {
      bookingsMap.set(b.id, b);
    });
    
    // Add last 10 bookings (will overwrite duplicates, but that's fine)
    lastTenBookings.forEach((b: any) => {
      bookingsMap.set(b.id, b);
    });

    // Convert to array and sort by date (most recent first)
    const finalBookings = Array.from(bookingsMap.values()).sort((a: any, b: any) => {
      const dateA = new Date(a.booking_date).getTime();
      const dateB = new Date(b.booking_date).getTime();
      return dateB - dateA;
    });

    // Format bookings for response
    const formattedBookings = finalBookings.map((booking: any) => ({
      id: booking.id,
      booking_date: booking.booking_date,
      service_name: booking.service_name,
      payment_status: booking.payment_status,
      total_paid: booking.total_paid_cents ? (Number(booking.total_paid_cents) / 100).toFixed(2) : '0.00',
      hapio_booking_id: booking.hapio_booking_id,
      created_at: booking.created_at,
    }));

    // Fetch upcoming bookings (future dates, not cancelled)
    const now = new Date();
    const upcomingBookingsResult = await sql`
      SELECT 
        b.id,
        b.booking_date,
        b.service_name,
        b.payment_status,
        b.created_at,
        b.hapio_booking_id,
        COALESCE(
          (
            SELECT SUM(p.amount_cents) - COALESCE(SUM(p.refunded_cents), 0)
            FROM payments p
            WHERE p.booking_id = b.id
              AND p.status = 'succeeded'
          ),
          0
        ) as total_paid_cents
      FROM bookings b
      WHERE (
        b.customer_id = ${customerId}
        OR LOWER(b.client_email) = LOWER(${customerEmail})
      )
        AND b.booking_date >= ${now.toISOString()}
        AND b.payment_status != 'cancelled'
      ORDER BY b.booking_date ASC
    `;

    const upcomingBookings = normalizeRows(upcomingBookingsResult);
    const formattedUpcoming = upcomingBookings.map((booking: any) => ({
      id: booking.id,
      booking_date: booking.booking_date,
      service_name: booking.service_name,
      payment_status: booking.payment_status,
      total_paid: booking.total_paid_cents ? (Number(booking.total_paid_cents) / 100).toFixed(2) : '0.00',
      hapio_booking_id: booking.hapio_booking_id,
      created_at: booking.created_at,
    }));

    return NextResponse.json({
      success: true,
      bookings: formattedBookings,
      upcoming: formattedUpcoming,
      count: formattedBookings.length,
      upcomingCount: formattedUpcoming.length,
      twelveMonthsCount: twelveMonthsBookings.length,
      lastTenCount: lastTenBookings.length,
    });
  } catch (error: any) {
    console.error('[Customer Bookings API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch booking history', 
        details: error.message,
      },
      { status: 500 }
    );
  }
}
