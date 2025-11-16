import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { upsertProduct, createStandardPrice } from '@/lib/stripeClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { serviceId } = await req.json();
    if (!serviceId) {
      return NextResponse.json({ error: 'Missing serviceId' }, { status: 400 });
    }
    const sql = getSqlClient();
    const rows = (await sql`
      SELECT id, slug, name, price, description
      FROM services
      WHERE id = ${serviceId}
      LIMIT 1
    `) as any[];
    const svc = rows?.[0];
    if (!svc) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    // Upsert product
    const product = await upsertProduct({
      name: svc.name,
      description: svc.description || undefined,
      metadata: { slug: svc.slug, service_id: svc.id },
    });
    if (svc.price && typeof svc.price === 'number') {
      await createStandardPrice({
        productId: product.id,
        unitAmount: Math.round(svc.price * 100),
        currency: 'usd',
      });
    }
    return NextResponse.json({ success: true, productId: product.id });
  } catch (error: any) {
    console.error('[Stripe Relink] error', error);
    return NextResponse.json({ error: 'Failed to relink', details: error?.message }, { status: 500 });
  }
}


