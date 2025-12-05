import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Stripe product relinking is deprecated
 * 
 * This endpoint previously relinked services to Stripe products.
 * MagicPay does not use product catalogs - prices are passed directly at payment time.
 * 
 * Original implementation archived at:
 * scripts/archive/stripe/api/admin/stripe/products/relink/route.ts
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Stripe product relinking is deprecated. MagicPay does not use product catalogs.',
      deprecated: true,
    },
    { status: 410 }
  );
}
