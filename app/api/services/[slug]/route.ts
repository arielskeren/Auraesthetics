import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { Service } from '@/lib/types/services';

/**
 * GET /api/services/[slug]
 * Public endpoint to get a single service by slug
 * Used by website components
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const sql = getSqlClient();
    const { slug } = params;

    const services = await sql`
      SELECT 
        id,
        slug,
        name,
        category,
        summary,
        description,
        duration_minutes,
        duration_display,
        price,
        test_pricing,
        image_url,
        image_filename,
        enabled,
        display_order,
        created_at,
        updated_at
      FROM services
      WHERE slug = ${slug} AND enabled = true
      LIMIT 1
    ` as Array<any>;

    if (services.length === 0) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(services[0] as Service);
  } catch (error: any) {
    console.error('[Services API] Error fetching service:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service', details: error.message },
      { status: 500 }
    );
  }
}

