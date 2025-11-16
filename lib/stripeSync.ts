import type { Service } from './types/services';
import { upsertProduct, createStandardPrice } from './stripeClient';

export type StripeSyncResult = {
  productId: string;
  priceId: string;
};

export async function syncServiceToStripe(params: {
  service: Pick<Service, 'id' | 'slug' | 'name' | 'category' | 'description' | 'price'>;
  existingProductId?: string | null;
  currency?: string; // default 'usd'
}): Promise<StripeSyncResult> {
  const { service, existingProductId, currency = 'usd' } = params;
  const product = await upsertProduct({
    id: existingProductId ?? undefined,
    name: service.name,
    description: service.description ?? undefined,
    active: true,
    metadata: {
      service_id: service.id,
      service_slug: service.slug,
      category: service.category ?? '',
    },
  });

  const unitAmount =
    typeof service.price === 'number' && Number.isFinite(service.price)
      ? Math.round(service.price * 100)
      : 0;

  const price = await createStandardPrice({
    productId: product.id,
    unitAmount,
    currency,
    nickname: `Standard`,
    metadata: {
      service_id: service.id,
      service_slug: service.slug,
    },
  });

  return { productId: product.id, priceId: price.id };
}


