import { NextRequest, NextResponse } from 'next/server';
import {
  getServiceResourceAssociation,
  associateServiceResource,
  dissociateServiceResource,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; resourceId: string } }
) {
  try {
    const association = await getServiceResourceAssociation(params.id, params.resourceId);
    return NextResponse.json({ association });
  } catch (error: any) {
    console.error('[Hapio] Failed to get service resource association', error);
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
  { params }: { params: { id: string; resourceId: string } }
) {
  try {
    const association = await associateServiceResource(params.id, params.resourceId);
    return NextResponse.json({ association });
  } catch (error: any) {
    console.error('[Hapio] Failed to associate service resource', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to associate resource';
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
  { params }: { params: { id: string; resourceId: string } }
) {
  try {
    await dissociateServiceResource(params.id, params.resourceId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Hapio] Failed to dissociate service resource', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to dissociate resource';
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

