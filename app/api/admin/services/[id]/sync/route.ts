import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { createService, updateService } from '@/lib/hapioClient';

/**
 * POST /api/admin/services/[id]/sync
 * Sync a Neon DB service to Hapio
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const { id } = params;

    // Get service from Neon DB
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
        enabled,
        hapio_service_id
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

    const service = services[0];

    // Map Neon DB service to Hapio payload
    // Store extra fields in metadata
    // Note: Hapio requires a 'type' field - using 'service' as the default type
    const hapioPayload = {
      name: service.name,
      duration_minutes: service.duration_minutes,
      type: 'service', // Required by Hapio API
      buffer_before_minutes: service.buffer_before_minutes || null,
      buffer_after_minutes: service.buffer_after_minutes || null,
      enabled: service.enabled !== false,
      metadata: {
        slug: service.slug,
        category: service.category || null,
        summary: service.summary || null,
        description: service.description || null,
        duration_display: service.duration_display || null,
        price: service.price != null ? Number(service.price) : null,
        test_pricing: service.test_pricing || false,
        image_url: null, // Don't sync image URL to Hapio metadata
      },
    };

    let hapioServiceId = service.hapio_service_id;
    let hapioService;

    if (hapioServiceId) {
      // Update existing Hapio service
      console.log(`[Sync Service] Updating Hapio service ${hapioServiceId} for Neon service ${id}`);
      hapioService = await updateService(hapioServiceId, hapioPayload);
    } else {
      // Create new Hapio service
      console.log(`[Sync Service] Creating new Hapio service for Neon service ${id}`);
      hapioService = await createService(hapioPayload);
      hapioServiceId = hapioService.id;

      // Save Hapio service ID back to Neon DB
      await sql`
        UPDATE services
        SET hapio_service_id = ${hapioServiceId}
        WHERE id = ${id}
      `;
    }

    return NextResponse.json({
      success: true,
      message: hapioServiceId === service.hapio_service_id 
        ? 'Service synced to Hapio successfully' 
        : 'Service created in Hapio and synced successfully',
      hapio_service_id: hapioServiceId,
      hapio_service: hapioService,
    });
  } catch (error: any) {
    console.error('[Sync Service API] Error syncing service to Hapio:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync service to Hapio', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

