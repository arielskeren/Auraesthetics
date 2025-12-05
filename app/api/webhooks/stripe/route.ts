import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * @deprecated Stripe webhooks are deprecated
 * 
 * This endpoint previously handled Stripe webhook events for payment confirmations.
 * With MagicPay, payments are confirmed synchronously in /api/magicpay/charge,
 * so webhooks are no longer needed.
 * 
 * The original implementation is archived at:
 * scripts/archive/stripe/api/webhooks/stripe/route.ts
 */
export async function POST(request: NextRequest) {
  console.warn('[Stripe Webhook] Deprecated webhook received - Stripe integration archived');
  
  // Return 200 to prevent Stripe from retrying
  // but log that this is deprecated
  return NextResponse.json({ 
    received: true,
    deprecated: true,
    message: 'Stripe webhooks are deprecated. Payments are now processed via MagicPay.',
  });
}
