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

    // Try with new columns first, fallback if they don't exist
    let services: any[];
    try {
      if (category) {
        services = await sql`
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
            starred,
            featured,
            best_seller,
            most_popular,
            created_at,
            updated_at
          FROM services
          WHERE enabled = true AND category = ${category} AND (category IS NULL OR category != 'Add-on')
          ORDER BY display_order ASC, created_at ASC
        ` as Array<any>;
      } else {
        services = await sql`
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
            starred,
            featured,
            best_seller,
            most_popular,
            created_at,
            updated_at
          FROM services
          WHERE enabled = true AND (category IS NULL OR category != 'Add-on')
          ORDER BY display_order ASC, created_at ASC
        ` as Array<any>;
      }
    } catch (error: any) {
      // If columns don't exist, query without them and add defaults
      if (error.message?.includes('column') && (error.message?.includes('starred') || error.message?.includes('featured'))) {
        if (category) {
          services = await sql`
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
            WHERE enabled = true AND category = ${category} AND (category IS NULL OR category != 'Add-on')
            ORDER BY display_order ASC, created_at ASC
          ` as Array<any>;
        } else {
          services = await sql`
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
            WHERE enabled = true AND (category IS NULL OR category != 'Add-on')
            ORDER BY display_order ASC, created_at ASC
          ` as Array<any>;
        }
        // Add default values for missing columns
        services = services.map((s) => ({
          ...s,
          starred: false,
          featured: false,
          best_seller: false,
          most_popular: false,
        }));
      } else {
        throw error;
      }
    }

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

