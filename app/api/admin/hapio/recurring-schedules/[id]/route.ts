import { NextRequest, NextResponse } from 'next/server';
import {
  getRecurringSchedule,
  updateRecurringSchedule,
  replaceRecurringSchedule,
  deleteRecurringSchedule,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const parentType = searchParams.get('parent_type') as 'project' | 'location' | 'resource' | null;
    const parentId = searchParams.get('parent_id') ?? undefined;

    if (!parentType) {
      return NextResponse.json(
        { error: 'Missing required parameter: parent_type' },
        { status: 400 }
      );
    }

    const schedule = await getRecurringSchedule(parentType, parentId, params.id);
    return NextResponse.json({ schedule });
  } catch (error: any) {
    console.error('[Hapio] Failed to get recurring schedule', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve recurring schedule';
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { parent_type, parent_id, ...scheduleData } = body;

    if (!parent_type) {
      return NextResponse.json(
        { error: 'Missing required parameter: parent_type' },
        { status: 400 }
      );
    }

    const schedule = await updateRecurringSchedule(
      parent_type as 'project' | 'location' | 'resource',
      parent_id,
      params.id,
      scheduleData
    );

    return NextResponse.json({ schedule });
  } catch (error: any) {
    console.error('[Hapio] Failed to update recurring schedule', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to update recurring schedule';
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { parent_type, parent_id, ...scheduleData } = body;

    if (!parent_type) {
      return NextResponse.json(
        { error: 'Missing required parameter: parent_type' },
        { status: 400 }
      );
    }

    const schedule = await replaceRecurringSchedule(
      parent_type as 'project' | 'location' | 'resource',
      parent_id,
      params.id,
      scheduleData
    );

    return NextResponse.json({ schedule });
  } catch (error: any) {
    console.error('[Hapio] Failed to replace recurring schedule', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to replace recurring schedule';
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const parentType = searchParams.get('parent_type') as 'project' | 'location' | 'resource' | null;
    const parentId = searchParams.get('parent_id') ?? undefined;

    if (!parentType) {
      return NextResponse.json(
        { error: 'Missing required parameter: parent_type' },
        { status: 400 }
      );
    }

    await deleteRecurringSchedule(parentType, parentId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to delete recurring schedule', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to delete recurring schedule';
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

