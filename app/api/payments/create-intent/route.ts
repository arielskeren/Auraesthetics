import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Stripe PaymentIntent creation is deprecated
 * 
 * This endpoint previously created Stripe PaymentIntents for the booking flow.
 * It has been replaced by /api/magicpay/charge which handles:
 * - Payment tokenization via Collect.js
 * - Direct charge via MagicPay API
 * - Booking finalization in one step
 * 
 * The original implementation is archived at:
 * scripts/archive/stripe/api/payments/create-intent/route.ts
 */
export async function POST(request: NextRequest) {
  console.warn('[Payments] create-intent endpoint is deprecated - redirecting to MagicPay');
  
  return NextResponse.json(
    { 
      error: 'Stripe PaymentIntents are deprecated. Use /api/magicpay/charge instead.',
      deprecated: true,
      migration: 'See /api/magicpay/charge for the new payment flow using MagicPay Collect.js',
    },
    { status: 410 } // 410 Gone
  );
}
