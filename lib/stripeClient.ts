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
      console.warn('[getStripeReceiptPdf] No charge found for payment intent:', paymentIntentId);
      return null;
    }
    
    // Get the charge to access receipt URL
    const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
    
    if (!charge.receipt_url) {
      console.warn('[getStripeReceiptPdf] No receipt URL for charge:', paymentIntent.latest_charge);
      return null;
    }
    
    // Fetch the PDF from Stripe's receipt URL with retry logic
    let receiptResponse: Response | null = null;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        receiptResponse = await fetch(charge.receipt_url, {
          method: 'GET',
          headers: {
            'User-Agent': 'AuraEsthetics/1.0',
          },
        });
        
        if (receiptResponse.ok) {
          break;
        }
        
        // If 404 or 403, receipt might not be available yet or URL expired
        if (receiptResponse.status === 404 || receiptResponse.status === 403) {
          console.warn(`[getStripeReceiptPdf] Receipt URL not accessible (${receiptResponse.status}):`, charge.receipt_url);
          return null;
        }
        
        // For other errors, retry with exponential backoff
        if (attempt < 2) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } catch (fetchError: any) {
        lastError = fetchError;
        if (attempt < 2) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }
    
    if (!receiptResponse || !receiptResponse.ok) {
      console.error('[getStripeReceiptPdf] Failed to fetch receipt after retries:', lastError || receiptResponse?.status);
      return null;
    }
    
    // Get content type to verify it's a PDF
    const contentType = receiptResponse.headers.get('content-type') || '';
    if (!contentType.includes('pdf') && !contentType.includes('application/octet-stream')) {
      console.warn('[getStripeReceiptPdf] Unexpected content type:', contentType);
    }
    
    // Convert to base64
    const arrayBuffer = await receiptResponse.arrayBuffer();
    
    // Validate PDF header (first 4 bytes should be "%PDF")
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const header = Array.from(headerBytes).map(b => String.fromCharCode(b)).join('');
    if (header !== '%PDF') {
      console.error('[getStripeReceiptPdf] Invalid PDF header:', header);
      return null;
    }
    
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString('base64');
    
    // Verify base64 encoding worked
    if (!base64Content || base64Content.length < 100) {
      console.error('[getStripeReceiptPdf] Invalid base64 content (too short)');
      return null;
    }
    
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


