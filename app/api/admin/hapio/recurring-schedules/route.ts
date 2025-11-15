import { NextRequest, NextResponse } from 'next/server';
import {
  listRecurringSchedules,
  createRecurringSchedule,
} from '@/lib/hapioClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentType = searchParams.get('parent_type') as 'project' | 'location' | 'resource' | null;
    const parentId = searchParams.get('parent_id') ?? undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    if (!parentType) {
      return NextResponse.json(
        { error: 'Missing required parameter: parent_type' },
        { status: 400 }
      );
    }

    const response = await listRecurringSchedules(
      parentType,
      parentId,
      {
        page,
        per_page: perPage,
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parent_type, parent_id, ...scheduleData } = body;

    if (!parent_type) {
      return NextResponse.json(
        { error: 'Missing required parameter: parent_type' },
        { status: 400 }
      );
    }

    const schedule = await createRecurringSchedule(
      parent_type as 'project' | 'location' | 'resource',
      parent_id,
      scheduleData
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

