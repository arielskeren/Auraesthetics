import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { stripe } from '@/lib/stripeClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const sql = getSqlClient();
    const services = (await sql`
      SELECT id, slug, name, price
      FROM services
      WHERE enabled = true
      ORDER BY display_order ASC, created_at ASC
    `) as Array<{ id: string; slug: string; name: string; price: number | null }>;

    // Fetch Stripe products (first 100 for now)
    const products = await stripe.products.list({ limit: 100, expand: ['data.default_price'] });

    const drift: any[] = [];
    for (const svc of services) {
      // Try to find matching product by metadata.slug or name
      const product =
        products.data.find((p) => (p.metadata?.slug || '').toLowerCase() === (svc.slug || '').toLowerCase()) ||
        products.data.find((p) => p.name?.toLowerCase() === (svc.name || '').toLowerCase());

      if (!product) {
        drift.push({ type: 'missing_in_stripe', service: svc });
        continue;
      }
      const priceObj = (product.default_price as any) || null;
      const unit_amount = priceObj?.unit_amount ?? null;
      const expectedCents = typeof svc.price === 'number' ? Math.round(svc.price * 100) : null;
      const mismatches: string[] = [];
      if (product.name !== svc.name) mismatches.push('name');
      if (expectedCents !== null && unit_amount !== null && expectedCents !== unit_amount) mismatches.push('price');
      if (mismatches.length > 0) {
        drift.push({
          type: 'mismatch',
          fields: mismatches,
          service: svc,
          stripe: {
            productId: product.id,
            name: product.name,
            unit_amount,
            currency: priceObj?.currency || 'usd',
          },
        });
      }
    }

    return NextResponse.json({ success: true, drift });
  } catch (error: any) {
    console.error('[Stripe Drift] error', error);
    return NextResponse.json({ error: 'Failed to compute drift', details: error?.message }, { status: 500 });
  }
}


