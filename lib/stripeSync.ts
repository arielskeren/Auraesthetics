/**
 * @deprecated Stripe integration has been replaced with MagicPay
 * 
 * This file is a stub to prevent import errors. The original implementation
 * has been moved to scripts/archive/stripe/lib/stripeSync.ts
 * 
 * MagicPay does not require service/product synchronization since payments
 * are processed with amount and description directly.
 */

import type { Service } from './types/services';

export type StripeSyncResult = {
  productId: string;
  priceId: string;
};

export async function syncServiceToStripe(_params: {
  service: Pick<Service, 'id' | 'slug' | 'name' | 'category' | 'description' | 'price'>;
  existingProductId?: string | null;
  currency?: string;
}): Promise<never> {
  throw new Error(
    'Stripe sync is deprecated. MagicPay does not require product synchronization. ' +
    'Services are charged by amount directly at payment time.'
  );
}
