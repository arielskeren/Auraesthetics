import { NextRequest, NextResponse } from 'next/server';
import {
  getRecurringSchedule,
  updateRecurringSchedule,
  replaceRecurringSchedule,
  deleteRecurringSchedule,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    const schedule = await getRecurringSchedule(
      'resource',
      params.id,
      params.scheduleId
    );

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
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    const body = await request.json();

    const schedule = await updateRecurringSchedule(
      'resource',
      params.id,
      params.scheduleId,
      body
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
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    const body = await request.json();

    const schedule = await replaceRecurringSchedule(
      'resource',
      params.id,
      params.scheduleId,
      body
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
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    await deleteRecurringSchedule(
      'resource',
      params.id,
      params.scheduleId
    );

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

