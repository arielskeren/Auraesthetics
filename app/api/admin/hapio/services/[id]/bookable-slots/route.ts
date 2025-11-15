import { NextRequest, NextResponse } from 'next/server';
import { listServiceBookableSlots } from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Missing required parameters: from and to' },
        { status: 400 }
      );
    }

    const locationId = searchParams.get('location_id') ?? undefined;
    const resourceId = searchParams.get('resource_id') ?? undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    const response = await listServiceBookableSlots(params.id, {
      from,
      to,
      location_id: locationId,
      resource_id: resourceId,
      page,
      per_page: perPage,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Hapio] Failed to get bookable slots', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve bookable slots';
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

