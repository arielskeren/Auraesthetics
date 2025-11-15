import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { Service } from '@/lib/types/services';

/**
 * GET /api/services
 * Public endpoint to list all enabled services
 * Used by website components
 */
export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    let query;
    if (category) {
      query = sql`
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
        WHERE enabled = true AND category = ${category}
        ORDER BY display_order ASC, name ASC
      `;
    } else {
      query = sql`
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
        WHERE enabled = true
        ORDER BY display_order ASC, category ASC, name ASC
      `;
    }

    const services = await query as Array<any>;

    // Format price for display (add "from $" prefix if price exists)
    const formattedServices = services.map((s: any) => ({
      ...s,
      price: s.price != null ? `from $${Number(s.price).toFixed(2).replace(/\.00$/, '')}` : null,
    }));

    return NextResponse.json(formattedServices as Service[]);
  } catch (error: any) {
    console.error('[Services API] Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services', details: error.message },
      { status: 500 }
    );
  }
}

