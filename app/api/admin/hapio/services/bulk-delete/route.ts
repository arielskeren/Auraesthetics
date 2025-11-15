import { NextRequest, NextResponse } from 'next/server';
import { deleteService } from '@/lib/hapioClient';

/**
 * POST /api/admin/hapio/services/bulk-delete
 * Delete multiple Hapio services
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceIds } = body;

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json(
        { error: 'serviceIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const results = {
      total: serviceIds.length,
      deleted: 0,
      failed: 0,
      errors: [] as Array<{ serviceId: string; error: string }>,
    };

    // Delete each service
    for (const serviceId of serviceIds) {
      try {
        await deleteService(serviceId);
        results.deleted++;
        console.log(`[Bulk Delete] Deleted Hapio service ${serviceId}`);
      } catch (error: any) {
        console.error(`[Bulk Delete] Failed to delete service ${serviceId}:`, error);
        results.failed++;
        results.errors.push({
          serviceId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.deleted} of ${results.total} services`,
      results,
    });
  } catch (error: any) {
    console.error('[Bulk Delete API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete services',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

