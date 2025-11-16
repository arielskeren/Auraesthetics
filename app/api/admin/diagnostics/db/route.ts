import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function safeQuery<T = any>(sql: any, strings: TemplateStringsArray, ...values: any[]): Promise<T | null> {
  try {
    // @ts-ignore -- use the sql tag
    const res = await sql(strings, ...values);
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

    const tables = ['bookings', 'customers', 'payments', 'booking_events'];
    const counts: Record<string, number | null> = {};
    for (const t of tables) {
      const c = (await safeQuery<any>(sql, [`SELECT COUNT(1)::int AS c FROM ${t}`] as any)) as any[] | null;
      counts[t] = c?.[0]?.c ?? null;
    }

    const bookingsCols = await safeQuery<any>(
      sql,
      ['SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position'] as any,
      'bookings'
    );
    const customersCols = await safeQuery<any>(
      sql,
      ['SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position'] as any,
      'customers'
    );

    const latestBookings = await safeQuery<any>(
      sql,
      ['SELECT id, hapio_booking_id, client_email, booking_date, payment_status, created_at FROM bookings ORDER BY created_at DESC NULLS LAST LIMIT 5'] as any
    );
    const latestCustomers = await safeQuery<any>(
      sql,
      ['SELECT id, email, first_name, last_name, last_seen_at FROM customers ORDER BY last_seen_at DESC NULLS LAST LIMIT 5'] as any
    );
    const latestPayments = await safeQuery<any>(
      sql,
      ['SELECT id, booking_id, stripe_pi_id, amount_cents, status, created_at FROM payments ORDER BY created_at DESC LIMIT 5'] as any
    );
    const latestEvents = await safeQuery<any>(
      sql,
      ['SELECT id, booking_id, type, created_at FROM booking_events ORDER BY created_at DESC LIMIT 5'] as any
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


