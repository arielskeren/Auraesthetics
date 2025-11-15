import { NextRequest, NextResponse } from 'next/server';
import {
  getService,
  updateService,
  replaceService,
  deleteService,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = await getService(params.id);
    return NextResponse.json({ service });
  } catch (error: any) {
    console.error('[Hapio] Failed to get service', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve service';
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
    const service = await updateService(params.id, body);
    return NextResponse.json({ service });
  } catch (error: any) {
    console.error('[Hapio] Failed to update service', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to update service';
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
    const service = await replaceService(params.id, body);
    return NextResponse.json({ service });
  } catch (error: any) {
    console.error('[Hapio] Failed to replace service', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to replace service';
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
    await deleteService(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to delete service', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to delete service';
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

