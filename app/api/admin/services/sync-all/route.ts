import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { createService, updateService } from '@/lib/hapioClient';
import { minutesToIso8601 } from '@/lib/hapioDurationUtils';

/**
 * POST /api/admin/services/sync-all
 * Sync all Neon DB services to Hapio
 */
export async function POST(request: NextRequest) {
  try {
    const sql = getSqlClient();

    // Get all services from Neon DB
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
      ORDER BY name ASC
    ` as Array<any>;

    if (services.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No services to sync',
        results: {
          total: 0,
          created: 0,
          updated: 0,
          failed: 0,
        },
      });
    }

    const results = {
      total: services.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ serviceId: string; serviceName: string; error: string }>,
    };

    // Sync each service
    for (const service of services) {
      try {
        // Map Neon DB service to Hapio payload
        const hapioPayload = {
          name: service.name,
          type: 'fixed' as const,
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
            image_url: null,
          },
        };

        let hapioServiceId = service.hapio_service_id;
        let wasCreated = false;

        if (hapioServiceId) {
          // Update existing Hapio service
          await updateService(hapioServiceId, hapioPayload);
          results.updated++;
        } else {
          // Create new Hapio service
          const hapioService = await createService(hapioPayload);
          hapioServiceId = hapioService.id;
          wasCreated = true;

          // Save Hapio service ID back to Neon DB
          await sql`
            UPDATE services
            SET hapio_service_id = ${hapioServiceId}
            WHERE id = ${service.id}
          `;
          results.created++;
        }

        console.log(`[Sync All] ${wasCreated ? 'Created' : 'Updated'} Hapio service ${hapioServiceId} for Neon service ${service.id} (${service.name})`);
      } catch (error: any) {
        console.error(`[Sync All] Failed to sync service ${service.id} (${service.name}):`, error);
        results.failed++;
        results.errors.push({
          serviceId: service.id,
          serviceName: service.name,
          error: error.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${results.total} services: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      results,
    });
  } catch (error: any) {
    console.error('[Sync All API] Error syncing services to Hapio:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync services to Hapio',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

