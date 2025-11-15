import { NextRequest, NextResponse } from 'next/server';
import { listBookingGroups, createBookingGroup } from '@/lib/hapioClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    const response = await listBookingGroups({
      page,
      per_page: perPage,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Hapio] Failed to list booking groups', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve booking groups';
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
    const group = await createBookingGroup(body);
    return NextResponse.json({ group });
  } catch (error: any) {
    console.error('[Hapio] Failed to create booking group', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create booking group';
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

