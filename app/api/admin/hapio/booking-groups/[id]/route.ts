import { NextRequest, NextResponse } from 'next/server';
import {
  getBookingGroup,
  updateBookingGroup,
  replaceBookingGroup,
  deleteBookingGroup,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const group = await getBookingGroup(params.id);
    return NextResponse.json({ group });
  } catch (error: any) {
    console.error('[Hapio] Failed to get booking group', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve booking group';
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
    const group = await updateBookingGroup(params.id, body);
    return NextResponse.json({ group });
  } catch (error: any) {
    console.error('[Hapio] Failed to update booking group', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to update booking group';
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
    const group = await replaceBookingGroup(params.id, body);
    return NextResponse.json({ group });
  } catch (error: any) {
    console.error('[Hapio] Failed to replace booking group', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to replace booking group';
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
    await deleteBookingGroup(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to delete booking group', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to delete booking group';
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

