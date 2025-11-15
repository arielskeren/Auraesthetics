import { NextRequest, NextResponse } from 'next/server';
import {
  getBooking,
  updateBooking,
  replaceBooking,
  cancelBooking,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const booking = await getBooking(params.id);
    return NextResponse.json({ booking });
  } catch (error: any) {
    console.error('[Hapio] Failed to get booking', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve booking';
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
    const booking = await updateBooking(params.id, body);
    return NextResponse.json({ booking });
  } catch (error: any) {
    console.error('[Hapio] Failed to update booking', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to update booking';
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
    const booking = await replaceBooking(params.id, body);
    return NextResponse.json({ booking });
  } catch (error: any) {
    console.error('[Hapio] Failed to replace booking', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to replace booking';
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
    await cancelBooking(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to cancel booking', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to cancel booking';
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

