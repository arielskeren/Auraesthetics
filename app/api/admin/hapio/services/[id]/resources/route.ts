import { NextRequest, NextResponse } from 'next/server';
import {
  listServiceAssociatedResources,
  associateServiceResource,
  dissociateServiceResource,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resources = await listServiceAssociatedResources(params.id);
    return NextResponse.json({ resources });
  } catch (error: any) {
    console.error('[Hapio] Failed to list service resources', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve service resources';
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

