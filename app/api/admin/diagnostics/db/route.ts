import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function safeQuery<T = any>(sql: any, query: any): Promise<T | null> {
  try {
    const res = await query;
    // Support both neon/sql returns
    if (Array.isArray(res)) return res as any;
    if (res && Array.isArray((res as any).rows)) return (res as any).rows as any;
    return res as any;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || request.headers.get('x-admin-diag-token');
    if (!token || token !== process.env.ADMIN_DIAG_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sql = getSqlClient();
    const dbUrl = process.env.DATABASE_URL || '';
    const hash = dbUrl ? crypto.createHash('sha1').update(dbUrl).digest('hex') : '';
    const short = hash ? `${hash.slice(0, 4)}...${hash.slice(-4)}` : 'n/a';

    const counts: Record<string, number | null> = {};
    const bookingsCount = (await safeQuery<any>(sql, sql`SELECT COUNT(1)::int AS c FROM bookings`)) as any[] | null;
    const customersCount = (await safeQuery<any>(sql, sql`SELECT COUNT(1)::int AS c FROM customers`)) as any[] | null;
    const paymentsCount = (await safeQuery<any>(sql, sql`SELECT COUNT(1)::int AS c FROM payments`)) as any[] | null;
    const eventsCount = (await safeQuery<any>(sql, sql`SELECT COUNT(1)::int AS c FROM booking_events`)) as any[] | null;
    counts.bookings = bookingsCount?.[0]?.c ?? null;
    counts.customers = customersCount?.[0]?.c ?? null;
    counts.payments = paymentsCount?.[0]?.c ?? null;
    counts.booking_events = eventsCount?.[0]?.c ?? null;

    const bookingsCols = await safeQuery<any>(
      sql,
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings' ORDER BY ordinal_position`
    );
    const customersCols = await safeQuery<any>(
      sql,
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position`
    );

    const latestBookings = await safeQuery<any>(
      sql,
      sql`SELECT id, hapio_booking_id, client_email, booking_date, payment_status, created_at FROM bookings ORDER BY created_at DESC NULLS LAST LIMIT 5`
    );
    const latestCustomers = await safeQuery<any>(
      sql,
      sql`SELECT id, email, first_name, last_name, last_seen_at FROM customers ORDER BY last_seen_at DESC NULLS LAST LIMIT 5`
    );
    const latestPayments = await safeQuery<any>(
      sql,
      sql`SELECT id, booking_id, stripe_pi_id, amount_cents, status, created_at FROM payments ORDER BY created_at DESC LIMIT 5`
    );
    const latestEvents = await safeQuery<any>(
      sql,
      sql`SELECT id, booking_id, type, created_at FROM booking_events ORDER BY created_at DESC LIMIT 5`
    );

    return NextResponse.json({
      env: { dbHash: short },
      counts,
      schema: { bookings: bookingsCols, customers: customersCols },
      latest: {
        bookings: latestBookings,
        customers: latestCustomers,
        payments: latestPayments,
        events: latestEvents,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Diagnostics failed', details: error?.message }, { status: 500 });
  }
}


