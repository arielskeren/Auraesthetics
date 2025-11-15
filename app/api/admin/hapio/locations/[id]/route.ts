import { NextRequest, NextResponse } from 'next/server';
import {
  getLocation,
  updateLocation,
  replaceLocation,
  deleteLocation,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const location = await getLocation(params.id);
    return NextResponse.json({ location });
  } catch (error: any) {
    console.error('[Hapio] Failed to get location', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve location';
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
    console.log('[Location API] PATCH request:', {
      locationId: params.id,
      body,
      bodyKeys: Object.keys(body),
    });
    
    const location = await updateLocation(params.id, body);
    
    console.log('[Location API] Update successful:', {
      locationId: location.id,
      name: location.name,
      address: location.address,
      timezone: location.timezone,
      enabled: location.enabled,
    });
    
    return NextResponse.json({ location });
  } catch (error: any) {
    console.error('[Hapio] Failed to update location', {
      locationId: params.id,
      error: error.message,
      status: error?.status,
      responseData: error?.response?.data,
      fullError: error,
    });
    const message = typeof error?.message === 'string' ? error.message : 'Failed to update location';
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
    const location = await replaceLocation(params.id, body);
    return NextResponse.json({ location });
  } catch (error: any) {
    console.error('[Hapio] Failed to replace location', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to replace location';
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
    await deleteLocation(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to delete location', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to delete location';
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

