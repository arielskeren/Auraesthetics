import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Token-expiration notifications are no longer necessary. Hapio slot locks are automatically released when Stripe marks payments as failed or when cancel/capture webhooks run.',
    },
    { status: 410 }
  );
}

