import { NextRequest, NextResponse } from 'next/server';
import { listResources, createResource } from '@/lib/hapioClient';
import { deduplicateRequest, getCacheKey } from '../_utils/requestDeduplication';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('location_id') ?? undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    const cacheKey = getCacheKey({
      endpoint: 'resources',
      locationId: locationId || '',
      page: page || '',
      perPage: perPage || '',
    });

    const response = await deduplicateRequest(cacheKey, async () => {
      return await listResources({
        location_id: locationId,
        page,
        per_page: perPage,
      });
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Hapio] Failed to list resources', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve resources';
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      {
        error: message,
        details: error?.response?.data || null,
      },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resource = await createResource(body);
    return NextResponse.json({ resource });
  } catch (error: any) {
    console.error('[Hapio] Failed to create resource', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create resource';
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      {
        error: message,
        details: error?.response?.data || null,
      },
      { status }
    );
  }
}

