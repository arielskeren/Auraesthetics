import { NextRequest, NextResponse } from 'next/server';
import { listResourceSchedule } from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    const response = await listResourceSchedule(params.id, {
      from,
      to,
      page,
      per_page: perPage,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Hapio] Failed to get resource schedule', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve resource schedule';
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

