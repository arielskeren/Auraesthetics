import { NextRequest, NextResponse } from 'next/server';
import {
  getResource,
  updateResource,
  replaceResource,
  deleteResource,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resource = await getResource(params.id);
    return NextResponse.json({ resource });
  } catch (error: any) {
    console.error('[Hapio] Failed to get resource', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve resource';
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
    const resource = await updateResource(params.id, body);
    return NextResponse.json({ resource });
  } catch (error: any) {
    console.error('[Hapio] Failed to update resource', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to update resource';
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
    const resource = await replaceResource(params.id, body);
    return NextResponse.json({ resource });
  } catch (error: any) {
    console.error('[Hapio] Failed to replace resource', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to replace resource';
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
    await deleteResource(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to delete resource', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to delete resource';
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

