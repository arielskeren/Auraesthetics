import { NextRequest, NextResponse } from 'next/server';
import { listServices } from '@/lib/hapioClient';

/**
 * GET /api/admin/hapio/services
 * List all services from Hapio API
 * Useful for verifying synced services
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('per_page') || '100', 10);

    const response = await listServices({ page, per_page: perPage });

    return NextResponse.json({
      success: true,
      data: response.data,
      meta: response.meta,
    });
  } catch (error: any) {
    console.error('[Hapio Services API] Error fetching services:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Hapio services',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
