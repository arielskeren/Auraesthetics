import { NextRequest, NextResponse } from 'next/server';
import {
  getResourceServiceAssociation,
  associateResourceService,
  dissociateResourceService,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; serviceId: string } }
) {
  try {
    const association = await getResourceServiceAssociation(params.id, params.serviceId);
    return NextResponse.json({ association });
  } catch (error: any) {
    console.error('[Hapio] Failed to get resource service association', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve association';
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; serviceId: string } }
) {
  try {
    const association = await associateResourceService(params.id, params.serviceId);
    return NextResponse.json({ association });
  } catch (error: any) {
    console.error('[Hapio] Failed to associate resource service', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to associate service';
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
  { params }: { params: { id: string; serviceId: string } }
) {
  try {
    await dissociateResourceService(params.id, params.serviceId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to dissociate resource service', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to dissociate service';
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

