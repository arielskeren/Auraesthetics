import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { createService, updateService } from '@/lib/hapioClient';
import { minutesToIso8601 } from '@/lib/hapioDurationUtils';

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
    // Hapio API requires:
    // - type: "fixed" | "flexible" | "day" (we use "fixed" for fixed-duration services)
    // - duration: ISO 8601 format (e.g., "PT60M" for 60 minutes)
    // - buffer_time_before/buffer_time_after: ISO 8601 format
    // - price: string with 3 decimal places (e.g., "150.000")
    // Store extra fields in metadata
    const hapioPayload = {
      name: service.name,
      type: 'fixed' as const, // All our services have fixed durations
      duration: minutesToIso8601(service.duration_minutes),
      buffer_time_before: minutesToIso8601(service.buffer_before_minutes || 0),
      buffer_time_after: minutesToIso8601(service.buffer_after_minutes || 0),
      enabled: service.enabled !== false,
      price: service.price != null ? Number(service.price).toFixed(3) : null,
      metadata: {
        slug: service.slug,
        category: service.category || null,
        summary: service.summary || null,
        description: service.description || null,
        duration_display: service.duration_display || null,
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

