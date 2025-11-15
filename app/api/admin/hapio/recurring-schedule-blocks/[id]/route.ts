import { NextRequest, NextResponse } from 'next/server';
import {
  getRecurringScheduleBlock,
  updateRecurringScheduleBlock,
  replaceRecurringScheduleBlock,
  deleteRecurringScheduleBlock,
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

    const block = await getRecurringScheduleBlock(parentType, parentId, params.id);
    return NextResponse.json({ block });
  } catch (error: any) {
    console.error('[Hapio] Failed to get recurring schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve recurring schedule block';
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
    const { parent_type, parent_id, ...blockData } = body;

    if (!parent_type) {
      return NextResponse.json(
        { error: 'Missing required parameter: parent_type' },
        { status: 400 }
      );
    }

    const block = await updateRecurringScheduleBlock(
      parent_type as 'project' | 'location' | 'resource',
      parent_id,
      params.id,
      blockData
    );

    return NextResponse.json({ block });
  } catch (error: any) {
    console.error('[Hapio] Failed to update recurring schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to update recurring schedule block';
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
    const { parent_type, parent_id, ...blockData } = body;

    if (!parent_type) {
      return NextResponse.json(
        { error: 'Missing required parameter: parent_type' },
        { status: 400 }
      );
    }

    const block = await replaceRecurringScheduleBlock(
      parent_type as 'project' | 'location' | 'resource',
      parent_id,
      params.id,
      blockData
    );

    return NextResponse.json({ block });
  } catch (error: any) {
    console.error('[Hapio] Failed to replace recurring schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to replace recurring schedule block';
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

    await deleteRecurringScheduleBlock(parentType, parentId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to delete recurring schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to delete recurring schedule block';
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

