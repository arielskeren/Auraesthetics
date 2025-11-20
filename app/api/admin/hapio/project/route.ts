import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProject } from '@/lib/hapioClient';
import { deduplicateRequest, getCacheKey } from '../_utils/requestDeduplication';

export async function GET(request: NextRequest) {
  try {
    // Use request deduplication to prevent duplicate calls
    const cacheKey = getCacheKey({
      endpoint: 'project',
    });

    const project = await deduplicateRequest(cacheKey, async () => {
      return await getCurrentProject();
    });

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('[Hapio] Failed to get project', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve project';
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

