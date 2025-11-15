import { NextRequest, NextResponse } from 'next/server';
import {
  getRecurringScheduleBlock,
  updateRecurringScheduleBlock,
  replaceRecurringScheduleBlock,
  deleteRecurringScheduleBlock,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; blockId: string } }
) {
  try {
    const block = await getRecurringScheduleBlock(
      'resource',
      params.id,
      params.blockId
    );

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
  { params }: { params: { id: string; blockId: string } }
) {
  try {
    const body = await request.json();

    const block = await updateRecurringScheduleBlock(
      'resource',
      params.id,
      params.blockId,
      body
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
  { params }: { params: { id: string; blockId: string } }
) {
  try {
    const body = await request.json();

    const block = await replaceRecurringScheduleBlock(
      'resource',
      params.id,
      params.blockId,
      body
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
  { params }: { params: { id: string; blockId: string } }
) {
  try {
    await deleteRecurringScheduleBlock(
      'resource',
      params.id,
      params.blockId
    );

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

