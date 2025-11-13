import { NextRequest, NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json(
    {
      error:
        'This endpoint has been retired. Hapio handles slot locking and cancellation. Please use /api/bookings/lock and Hapio webhooks.',
    },
    { status: 410 }
  );
}

