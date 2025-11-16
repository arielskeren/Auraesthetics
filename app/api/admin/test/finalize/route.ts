import { NextRequest, NextResponse } from 'next/server';
import { finalizeBookingTransactional } from '@/lib/bookings/finalizeCore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { hapioBookingId, paymentIntentId } = await request.json();
    if (!hapioBookingId || !paymentIntentId) {
      return NextResponse.json({ error: 'Missing hapioBookingId or paymentIntentId' }, { status: 400 });
    }
    const result = await finalizeBookingTransactional({ hapioBookingId, paymentIntentId, debug: true });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: 'Synthetic finalize failed', details: error?.message }, { status: 500 });
  }
}


