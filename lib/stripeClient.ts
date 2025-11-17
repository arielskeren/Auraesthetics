import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY env var');
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
});

export type UpsertProductInput = {
  id?: string | null;
  name: string;
  description?: string | null;
  active?: boolean;
  metadata?: Record<string, string>;
};

export async function upsertProduct(input: UpsertProductInput) {
  if (input.id) {
    return stripe.products.update(input.id, {
      name: input.name,
      description: input.description ?? undefined,
      active: input.active ?? true,
      metadata: input.metadata,
    });
  }
  return stripe.products.create({
    name: input.name,
    description: input.description ?? undefined,
    active: input.active ?? true,
    metadata: input.metadata,
  });
}

export type UpsertPriceInput = {
  productId: string;
  unitAmount: number; // cents
  currency: string; // e.g. 'usd'
  nickname?: string | null;
  metadata?: Record<string, string>;
};

export async function createStandardPrice(input: UpsertPriceInput) {
  return stripe.prices.create({
    product: input.productId,
    unit_amount: input.unitAmount,
    currency: input.currency,
    nickname: input.nickname ?? undefined,
    metadata: input.metadata,
  });
}

export type CreatePaymentIntentInput = {
  amount: number; // cents
  currency: string;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
};

export async function createPaymentIntent(input: CreatePaymentIntentInput) {
  return stripe.paymentIntents.create({
    amount: input.amount,
    currency: input.currency,
    receipt_email: input.customerEmail ?? undefined,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: input.metadata,
  });
}

export function constructWebhookEvent(payload: Buffer, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET env var');
  }
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Get Stripe receipt PDF as base64-encoded string for email attachment
 * @param paymentIntentId - Stripe PaymentIntent ID
 * @returns Base64-encoded PDF content and filename, or null if unavailable
 */
export async function getStripeReceiptPdf(
  paymentIntentId: string
): Promise<{ content: string; filename: string } | null> {
  try {
    // Retrieve the payment intent to get the charge ID
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (!paymentIntent.latest_charge || typeof paymentIntent.latest_charge !== 'string') {
      return null;
    }
    
    // Get the charge to access receipt URL
    const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
    
    if (!charge.receipt_url) {
      return null;
    }
    
    // Fetch the PDF from Stripe's receipt URL
    // Note: Stripe receipt URLs are publicly accessible but time-limited
    const receiptResponse = await fetch(charge.receipt_url);
    if (!receiptResponse.ok) {
      return null;
    }
    
    // Convert to base64
    const arrayBuffer = await receiptResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString('base64');
    
    return {
      content: base64Content,
      filename: `receipt-${paymentIntentId}.pdf`,
    };
  } catch (error) {
    console.error('[getStripeReceiptPdf] Error:', error);
    return null;
  }
}

/**
 * Get Stripe refund receipt PDF as base64-encoded string for email attachment
 * @param refundId - Stripe Refund ID
 * @returns Base64-encoded PDF content and filename, or null if unavailable
 */
export async function getStripeRefundReceiptPdf(
  refundId: string
): Promise<{ content: string; filename: string } | null> {
  try {
    const refund = await stripe.refunds.retrieve(refundId);
    
    // Stripe refunds don't have direct receipt URLs, but we can generate one
    // by fetching the payment intent's receipt and noting it's a refund
    if (refund.payment_intent && typeof refund.payment_intent === 'string') {
      const receipt = await getStripeReceiptPdf(refund.payment_intent);
      if (receipt) {
        return {
          content: receipt.content,
          filename: `refund-receipt-${refundId}.pdf`,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('[getStripeRefundReceiptPdf] Error:', error);
    return null;
  }
}


