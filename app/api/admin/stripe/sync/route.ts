import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Stripe sync is deprecated
 * 
 * This endpoint previously synced services to Stripe products/prices.
 * MagicPay does not require product synchronization - payments are
 * processed with amount and description directly at payment time.
 * 
 * Original implementation archived at:
 * scripts/archive/stripe/api/admin/stripe/sync/route.ts
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Stripe sync is deprecated. MagicPay does not require product synchronization.',
      deprecated: true,
    },
    { status: 410 }
  );
}
