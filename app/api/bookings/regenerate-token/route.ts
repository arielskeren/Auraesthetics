import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Booking tokens are no longer required. The Hapio flow locks slots directly and confirmations happen via Stripe + Hapio webhooks.',
    },
    { status: 410 }
  );
}

