import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { syncServiceToStripe } from '@/lib/stripeSync';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { all, serviceIds } = body || {};

    const sql = getSqlClient();
    let services: Array<any> = [];

    if (all) {
      services = (await sql`
        SELECT id, slug, name, category, description, price
        FROM services
        ORDER BY display_order ASC, created_at ASC
      `) as any[];
    } else if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      services = (await sql`
        SELECT id, slug, name, category, description, price
        FROM services
        WHERE id = ANY(${serviceIds})
      `) as any[];
    } else {
      return NextResponse.json(
        { error: 'Provide { all: true } or { serviceIds: [...] }' },
        { status: 400 }
      );
    }

    const results: Array<{ serviceId: string; productId: string; priceId: string }> = [];
    for (const svc of services) {
      const { productId, priceId } = await syncServiceToStripe({
        service: {
          id: svc.id,
          slug: svc.slug,
          name: svc.name,
          category: svc.category,
          description: svc.description,
          price: typeof svc.price === 'number' ? svc.price : null,
        },
        existingProductId: null,
      });
      results.push({ serviceId: svc.id, productId, priceId });
    }

    return NextResponse.json({
      message: `Synced ${results.length} service(s) to Stripe`,
      results,
    });
  } catch (error: any) {
    console.error('[Stripe Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync to Stripe', details: error?.message },
      { status: 500 }
    );
  }
}


