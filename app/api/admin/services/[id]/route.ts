import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { Service, ServiceUpdateInput } from '@/lib/types/services';

/**
 * GET /api/admin/services/[id]
 * Get a single service by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const { id } = params;

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
      WHERE id = ${id}
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
    console.error('[Admin Services API] Error fetching service:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/services/[id]
 * Update a service
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const { id } = params;
    const body: ServiceUpdateInput = await request.json();

    // Check if service exists
    const existing = await sql`
      SELECT id FROM services WHERE id = ${id}
    ` as Array<any>;
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // If slug is being updated, check for conflicts
    if (body.slug) {
      const slugConflict = await sql`
        SELECT id FROM services WHERE slug = ${body.slug} AND id != ${id}
      ` as Array<any>;
      if (slugConflict.length > 0) {
        return NextResponse.json(
          { error: 'Service with this slug already exists' },
          { status: 409 }
        );
      }
    }

    // Get current service to merge with updates
    const current = await sql`
      SELECT * FROM services WHERE id = ${id}
    ` as Array<any>;
    
    if (current.length === 0) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    const currentService = current[0];

    // Merge updates with current values
    const updatedService = {
      slug: body.slug !== undefined ? body.slug : currentService.slug,
      name: body.name !== undefined ? body.name : currentService.name,
      category: body.category !== undefined ? body.category : currentService.category,
      summary: body.summary !== undefined ? body.summary : currentService.summary,
      description: body.description !== undefined ? body.description : currentService.description,
      duration_minutes: body.duration_minutes !== undefined ? body.duration_minutes : currentService.duration_minutes,
      duration_display: body.duration_display !== undefined ? body.duration_display : currentService.duration_display,
      price: body.price !== undefined ? body.price : currentService.price,
      buffer_before_minutes: body.buffer_before_minutes !== undefined ? body.buffer_before_minutes : (currentService.buffer_before_minutes || 0),
      buffer_after_minutes: body.buffer_after_minutes !== undefined ? body.buffer_after_minutes : (currentService.buffer_after_minutes || 0),
      test_pricing: body.test_pricing !== undefined ? body.test_pricing : currentService.test_pricing,
      enabled: body.enabled !== undefined ? body.enabled : currentService.enabled,
      display_order: body.display_order !== undefined ? body.display_order : currentService.display_order,
    };

    // Execute update
    const result = await sql`
      UPDATE services 
      SET 
        slug = ${updatedService.slug},
        name = ${updatedService.name},
        category = ${updatedService.category},
        summary = ${updatedService.summary},
        description = ${updatedService.description},
        duration_minutes = ${updatedService.duration_minutes},
        duration_display = ${updatedService.duration_display},
        price = ${updatedService.price},
        buffer_before_minutes = ${updatedService.buffer_before_minutes},
        buffer_after_minutes = ${updatedService.buffer_after_minutes},
        test_pricing = ${updatedService.test_pricing},
        enabled = ${updatedService.enabled},
        display_order = ${updatedService.display_order},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    ` as Array<any>;

    return NextResponse.json(result[0] as Service);
  } catch (error: any) {
    console.error('[Admin Services API] Error updating service:', error);
    return NextResponse.json(
      { error: 'Failed to update service', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/services/[id]
 * Delete a service
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const { id } = params;

    // Check if service exists
    const existing = await sql`
      SELECT id, image_url FROM services WHERE id = ${id}
    ` as Array<{ id: string; image_url: string | null }>;
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Delete image from blob if exists
    if (existing[0].image_url) {
      try {
        const { deleteImage } = await import('@/lib/blobClient');
        await deleteImage(existing[0].image_url);
      } catch (blobError) {
        console.warn('[Admin Services API] Failed to delete image from blob:', blobError);
        // Continue with service deletion even if image deletion fails
      }
    }

    // Delete service
    await sql`
      DELETE FROM services WHERE id = ${id}
    `;

    return NextResponse.json({ message: 'Service deleted successfully' });
  } catch (error: any) {
    console.error('[Admin Services API] Error deleting service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service', details: error.message },
      { status: 500 }
    );
  }
}

