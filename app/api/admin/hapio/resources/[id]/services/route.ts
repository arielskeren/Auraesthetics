import { NextRequest, NextResponse } from 'next/server';
import {
  listResourceAssociatedServices,
  associateResourceService,
  dissociateResourceService,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const services = await listResourceAssociatedServices(params.id);
    return NextResponse.json({ services });
  } catch (error: any) {
    console.error('[Hapio] Failed to list resource services', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve resource services';
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

