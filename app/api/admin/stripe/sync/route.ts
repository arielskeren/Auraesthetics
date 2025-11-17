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

    const results: Array<{ serviceId: string; productId: string; priceId: string; error?: string }> = [];
    const errors: Array<{ serviceId: string; serviceName: string; error: string }> = [];
    
    for (const svc of services) {
      try {
        // Price is stored as NUMERIC in database, should be a number
        // Handle case where driver might return as string (though it shouldn't)
        const price = typeof svc.price === 'number' 
          ? svc.price 
          : (svc.price != null ? parseFloat(String(svc.price)) : null);
        
        const { productId, priceId } = await syncServiceToStripe({
          service: {
            id: svc.id,
            slug: svc.slug,
            name: svc.name,
            category: svc.category,
            description: svc.description,
            price: Number.isFinite(price) ? price : null,
          },
          existingProductId: null,
        });
        results.push({ serviceId: svc.id, productId, priceId });
      } catch (err: any) {
        const errorMsg = err?.message || 'Unknown error';
        console.error(`[Stripe Sync] Failed to sync service ${svc.id} (${svc.name}):`, errorMsg);
        errors.push({ serviceId: svc.id, serviceName: svc.name, error: errorMsg });
        results.push({ serviceId: svc.id, productId: '', priceId: '', error: errorMsg });
      }
    }

    const successCount = results.filter(r => !r.error).length;
    const failCount = errors.length;
    
    return NextResponse.json({
      message: `Synced ${successCount} service(s) to Stripe${failCount > 0 ? `, ${failCount} failed` : ''}`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[Stripe Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync to Stripe', details: error?.message },
      { status: 500 }
    );
  }
}


