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


