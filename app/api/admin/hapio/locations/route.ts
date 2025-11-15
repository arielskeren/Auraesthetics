import { NextRequest, NextResponse } from 'next/server';
import { listLocations, createLocation } from '@/lib/hapioClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    const response = await listLocations({
      page,
      per_page: perPage,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Hapio] Failed to list locations', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve locations';
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
    const location = await createLocation(body);
    return NextResponse.json({ location });
  } catch (error: any) {
    console.error('[Hapio] Failed to create location', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create location';
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

