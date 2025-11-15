import { NextRequest, NextResponse } from 'next/server';
import { listServices, createService } from '@/lib/hapioClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    const response = await listServices({
      page,
      per_page: perPage,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Hapio] Failed to list services', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve services';
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
    const service = await createService(body);
    return NextResponse.json({ service });
  } catch (error: any) {
    console.error('[Hapio] Failed to create service', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create service';
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

