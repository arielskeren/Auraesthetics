import { NextRequest, NextResponse } from 'next/server';
import {
  listRecurringSchedules,
  createRecurringSchedule,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    const response = await listRecurringSchedules(
      'resource',
      params.id,
      {
        page,
        per_page: perPage,
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    // Handle 404 errors gracefully - return empty array if endpoint doesn't exist
    if (error?.status === 404 || error?.response?.status === 404) {
      const { searchParams } = new URL(request.url);
      const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : 20;
      return NextResponse.json({
        data: [],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: perPage,
          total: 0,
          from: null,
          to: null,
        },
        links: {
          first: null,
          last: null,
          prev: null,
          next: null,
        },
      });
    }

    console.error('[Hapio] Failed to list recurring schedules', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve recurring schedules';
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const schedule = await createRecurringSchedule(
      'resource',
      params.id,
      body
    );

    return NextResponse.json({ schedule });
  } catch (error: any) {
    console.error('[Hapio] Failed to create recurring schedule', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create recurring schedule';
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

