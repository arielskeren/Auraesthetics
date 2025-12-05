/**
 * @deprecated Stripe integration has been replaced with MagicPay
 * 
 * This file is a stub to prevent import errors. The original implementation
 * has been moved to scripts/archive/stripe/lib/stripeClient.ts
 * 
 * For payment processing, use lib/magicpayClient.ts instead.
 */

// Export stub types to prevent TypeScript errors in legacy code
export type UpsertProductInput = {
  id?: string | null;
  name: string;
  description?: string | null;
  active?: boolean;
  metadata?: Record<string, string>;
};

export type UpsertPriceInput = {
  productId: string;
  unitAmount: number;
  currency: string;
  nickname?: string | null;
  metadata?: Record<string, string>;
};

export type CreatePaymentIntentInput = {
  amount: number;
  currency: string;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
};

// Stub stripe instance - throws if actually used
export const stripe = new Proxy({}, {
  get() {
    throw new Error(
      'Stripe integration is deprecated. Use MagicPay instead. ' +
      'See lib/magicpayClient.ts for the new payment implementation.'
    );
  }
}) as any;

// Stub functions that throw if called
export async function upsertProduct(_input: UpsertProductInput): Promise<never> {
  throw new Error('Stripe integration is deprecated. upsertProduct is no longer available.');
}

export async function createStandardPrice(_input: UpsertPriceInput): Promise<never> {
  throw new Error('Stripe integration is deprecated. createStandardPrice is no longer available.');
}

export async function createPaymentIntent(_input: CreatePaymentIntentInput): Promise<never> {
  throw new Error('Stripe integration is deprecated. Use /api/magicpay/charge instead.');
}

export function constructWebhookEvent(_payload: Buffer, _signature: string): never {
  throw new Error('Stripe webhooks are deprecated. Payments are now processed synchronously via MagicPay.');
}

export async function getStripeReceiptPdf(_paymentIntentId: string): Promise<null> {
  console.warn('[stripeClient] getStripeReceiptPdf is deprecated - Stripe integration archived');
  return null;
}

export async function getStripeRefundReceiptPdf(_refundId: string): Promise<null> {
  console.warn('[stripeClient] getStripeRefundReceiptPdf is deprecated - Stripe integration archived');
  return null;
}
