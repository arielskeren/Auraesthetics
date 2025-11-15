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
    console.log('[Location API] PATCH request received:', {
      locationId: params.id,
      requestBody: body,
      bodyKeys: Object.keys(body),
      bodyValues: Object.values(body),
    });
    
    const location = await updateLocation(params.id, body);
    
    // Compare request vs response to detect mismatches
    const requestResponseComparison = {
      street1: {
        requested: body.street1,
        received: location.street1,
        match: body.street1 === location.street1,
      },
      city: {
        requested: body.city,
        received: location.city,
        match: body.city === location.city,
      },
      state: {
        requested: body.state,
        received: location.state,
        match: body.state === location.state,
      },
      zip: {
        requested: body.zip,
        received: location.zip,
        match: body.zip === location.zip,
      },
      address: {
        requested: body.address,
        received: location.address,
        match: body.address === location.address,
      },
      timezone: {
        requested: body.timezone,
        received: location.timezone,
        match: body.timezone === location.timezone,
      },
      name: {
        requested: body.name,
        received: location.name,
        match: body.name === location.name,
      },
      enabled: {
        requested: body.enabled,
        received: location.enabled,
        match: body.enabled === location.enabled,
      },
    };
    
    console.log('[Location API] Update successful:', {
      locationId: location.id,
      name: location.name,
      street1: location.street1,
      street2: location.street2,
      city: location.city,
      state: location.state,
      country: location.country,
      zip: location.zip,
      address: location.address, // Deprecated
      timezone: location.timezone,
      enabled: location.enabled,
    });
    
    console.log('[Location API] Request vs Response comparison:', requestResponseComparison);
    
    // Log any mismatches
    const mismatches = Object.entries(requestResponseComparison)
      .filter(([_, comparison]) => !comparison.match)
      .map(([field, comparison]) => ({ field, ...comparison }));
    
    if (mismatches.length > 0) {
      console.warn('[Location API] Field mismatches detected between request and response:', mismatches);
    } else {
      console.log('[Location API] All fields match between request and response');
    }
    
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

