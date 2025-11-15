import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProject } from '@/lib/hapioClient';

export async function GET(request: NextRequest) {
  try {
    const project = await getCurrentProject();
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

