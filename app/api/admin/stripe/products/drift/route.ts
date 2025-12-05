import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Stripe product drift detection is deprecated
 * 
 * This endpoint previously checked for price drift between database and Stripe.
 * MagicPay does not use product catalogs - prices are passed directly at payment time.
 * 
 * Original implementation archived at:
 * scripts/archive/stripe/api/admin/stripe/products/drift/route.ts
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Stripe product drift check is deprecated. MagicPay does not use product catalogs.',
      deprecated: true,
      driftItems: [],
    },
    { status: 410 }
  );
}
