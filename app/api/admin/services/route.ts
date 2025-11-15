import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { Service, ServiceCreateInput } from '@/lib/types/services';

/**
 * GET /api/admin/services
 * List all services with pagination (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('per_page') || '20', 10);
    const offset = (page - 1) * perPage;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total FROM services
    ` as Array<{ total: number | string }>;
    const total = Number(countResult[0]?.total || 0);

    // Get services - try with new columns first, fallback if they don't exist
    let services: any[];
    try {
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
          buffer_before_minutes,
          buffer_after_minutes,
          test_pricing,
          image_url,
          image_filename,
          enabled,
          display_order,
          starred,
          featured,
          best_seller,
          most_popular,
          hapio_service_id,
          created_at,
          updated_at
        FROM services
        ORDER BY display_order ASC, created_at ASC
        LIMIT ${perPage}
        OFFSET ${offset}
      ` as Array<any>;
    } catch (error: any) {
      // If columns don't exist, query without them and add defaults
      if (error.message?.includes('column') && (error.message?.includes('starred') || error.message?.includes('featured'))) {
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
            buffer_before_minutes,
            buffer_after_minutes,
            test_pricing,
            image_url,
            image_filename,
            enabled,
            display_order,
            hapio_service_id,
            created_at,
            updated_at
          FROM services
          ORDER BY display_order ASC, created_at ASC
          LIMIT ${perPage}
          OFFSET ${offset}
        ` as Array<any>;
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

    const lastPage = Math.ceil(total / perPage);

    return NextResponse.json({
      data: services as Service[],
      meta: {
        current_page: page,
        per_page: perPage,
        total,
        last_page: lastPage,
        from: offset + 1,
        to: Math.min(offset + perPage, total),
      },
    });
  } catch (error: any) {
    console.error('[Admin Services API] Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/services
 * Create a new service
 */
export async function POST(request: NextRequest) {
  try {
    const sql = getSqlClient();
    const body: ServiceCreateInput = await request.json();

    // Validate required fields
    if (!body.slug || !body.name || body.duration_minutes === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, name, duration_minutes' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existing = await sql`
      SELECT id FROM services WHERE slug = ${body.slug}
    ` as Array<any>;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Service with this slug already exists' },
        { status: 409 }
      );
    }

    // Get max display_order for auto-assignment
    const maxOrderResult = await sql`
      SELECT COALESCE(MAX(display_order), 0) as max_order FROM services
    ` as Array<{ max_order: number }>;
    const nextDisplayOrder = body.display_order ?? (maxOrderResult[0]?.max_order ?? 0) + 1;

    // Insert service
    const result = await sql`
      INSERT INTO services (
        slug,
        name,
        category,
        summary,
        description,
        duration_minutes,
        duration_display,
        price,
        buffer_before_minutes,
        buffer_after_minutes,
        test_pricing,
        enabled,
        display_order,
        starred,
        featured,
        best_seller,
        most_popular
      ) VALUES (
        ${body.slug},
        ${body.name},
        ${body.category || null},
        ${body.summary || null},
        ${body.description || null},
        ${body.duration_minutes},
        ${body.duration_display || null},
        ${body.price || null},
        ${body.buffer_before_minutes || 0},
        ${body.buffer_after_minutes || 0},
        ${body.test_pricing || false},
        ${body.enabled !== false},
        ${nextDisplayOrder},
        ${body.starred || false},
        ${body.featured || false},
        ${body.best_seller || false},
        ${body.most_popular || false}
      )
      RETURNING *
    ` as Array<any>;

    return NextResponse.json(result[0] as Service, { status: 201 });
  } catch (error: any) {
    console.error('[Admin Services API] Error creating service:', error);
    return NextResponse.json(
      { error: 'Failed to create service', details: error.message },
      { status: 500 }
    );
  }
}

