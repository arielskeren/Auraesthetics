import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const customerId = params.id;
    const rows = (await sql`
      SELECT 
        b.id as booking_id,
        b.service_name,
        b.service_id,
        b.booking_date,
        b.metadata,
        COALESCE(p.amount_cents, 0) as amount_cents,
        COALESCE(p.currency, 'usd') as currency,
        COALESCE(p.status, b.payment_status) as payment_status
      FROM bookings b
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.customer_id = ${customerId}
      ORDER BY b.booking_date DESC NULLS LAST, b.created_at DESC
      LIMIT 50
    `) as any[];

    const history = rows.map((r) => ({
      bookingId: r.booking_id,
      serviceName: r.service_name,
      serviceId: r.service_id,
      bookingDate: r.booking_date,
      notes: r.metadata?.notes ?? null,
      amountPaidCents: typeof r.amount_cents === 'number' ? r.amount_cents : 0,
      currency: r.currency || 'usd',
      paymentStatus: r.payment_status || 'unknown',
    }));

    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    console.error('[Customers] history error', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer history', details: error?.message },
      { status: 500 }
    );
  }
}


