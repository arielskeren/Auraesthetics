import { NextRequest, NextResponse } from 'next/server';
import {
  listScheduleBlocks,
  createScheduleBlock,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    const response = await listScheduleBlocks(
      'resource',
      params.id,
      {
        from,
        to,
        page,
        per_page: perPage,
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Hapio] Failed to list schedule blocks', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve schedule blocks';
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
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const block = await createScheduleBlock(
      'resource',
      params.id,
      body
    );

    return NextResponse.json({ block });
  } catch (error: any) {
    console.error('[Hapio] Failed to create schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create schedule block';
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

