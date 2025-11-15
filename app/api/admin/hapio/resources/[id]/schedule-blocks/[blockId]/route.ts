import { NextRequest, NextResponse } from 'next/server';
import {
  getScheduleBlock,
  updateScheduleBlock,
  replaceScheduleBlock,
  deleteScheduleBlock,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; blockId: string } }
) {
  try {
    const block = await getScheduleBlock(
      'resource',
      params.id,
      params.blockId
    );

    return NextResponse.json({ block });
  } catch (error: any) {
    console.error('[Hapio] Failed to get schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve schedule block';
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

    const block = await updateScheduleBlock(
      'resource',
      params.id,
      params.blockId,
      body
    );

    return NextResponse.json({ block });
  } catch (error: any) {
    console.error('[Hapio] Failed to update schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to update schedule block';
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

    const block = await replaceScheduleBlock(
      'resource',
      params.id,
      params.blockId,
      body
    );

    return NextResponse.json({ block });
  } catch (error: any) {
    console.error('[Hapio] Failed to replace schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to replace schedule block';
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
    await deleteScheduleBlock(
      'resource',
      params.id,
      params.blockId
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to delete schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to delete schedule block';
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

