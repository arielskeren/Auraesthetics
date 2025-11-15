import { NextRequest, NextResponse } from 'next/server';
import {
  listRecurringScheduleBlocks,
  createRecurringScheduleBlock,
} from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const recurringScheduleId = searchParams.get('recurring_schedule_id');
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;
    const listAll = searchParams.get('list_all') === 'true'; // New parameter to list all blocks

    // If list_all is true, fetch all schedules and their blocks
    if (listAll) {
      const { listRecurringSchedules } = await import('@/lib/hapioClient');
      
      // First, get all recurring schedules
      const schedulesResponse = await listRecurringSchedules(
        'resource',
        params.id,
        { per_page: 100 }
      ).catch(() => ({ data: [], meta: { total: 0 } }));

      const allBlocks: any[] = [];
      
      // For each schedule, fetch its blocks
      if (schedulesResponse.data && Array.isArray(schedulesResponse.data)) {
        for (const schedule of schedulesResponse.data) {
          try {
            const blocksResponse = await listRecurringScheduleBlocks(
              'resource',
              params.id,
              {
                recurring_schedule_id: schedule.id,
                per_page: 100,
              }
            ).catch(() => ({ data: [], meta: { total: 0 } }));
            
            if (blocksResponse.data && Array.isArray(blocksResponse.data)) {
              // Add the parent schedule info to each block
              blocksResponse.data.forEach((block: any) => {
                allBlocks.push({
                  ...block,
                  parent_schedule: {
                    id: schedule.id,
                    start_date: schedule.start_date,
                    end_date: schedule.end_date,
                  },
                });
              });
            }
          } catch (err) {
            // Silently skip schedules that fail
            console.warn(`[Recurring Schedule Blocks API] Failed to fetch blocks for schedule ${schedule.id}:`, err);
          }
        }
      }

      return NextResponse.json({
        data: allBlocks,
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: allBlocks.length,
          total: allBlocks.length,
          from: allBlocks.length > 0 ? 1 : null,
          to: allBlocks.length > 0 ? allBlocks.length : null,
        },
        links: {
          first: null,
          last: null,
          prev: null,
          next: null,
        },
      });
    }

    // Original behavior: require recurring_schedule_id
    if (!recurringScheduleId) {
      return NextResponse.json(
        { error: 'recurring_schedule_id query parameter is required (or use list_all=true)' },
        { status: 400 }
      );
    }

    const response = await listRecurringScheduleBlocks(
      'resource',
      params.id,
      {
        recurring_schedule_id: recurringScheduleId,
        page,
        per_page: perPage,
      }
    );

    return NextResponse.json(response);
  } catch (error: any) {
    // Handle 404 errors gracefully - return empty array if endpoint doesn't exist
    if (error?.status === 404 || error?.response?.status === 404) {
      const { searchParams } = new URL(request.url);
      const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : 20;
      return NextResponse.json({
        data: [],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: perPage,
          total: 0,
          from: null,
          to: null,
        },
        links: {
          first: null,
          last: null,
          prev: null,
          next: null,
        },
      });
    }

    console.error('[Hapio] Failed to list recurring schedule blocks', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve recurring schedule blocks';
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
    
    console.log('[Recurring Schedule Blocks API] POST request:', {
      resourceId: params.id,
      body,
      recurringScheduleId: body.recurring_schedule_id,
      hasRecurringScheduleId: !!body.recurring_schedule_id,
    });

    if (!body.recurring_schedule_id) {
      return NextResponse.json(
        { error: 'recurring_schedule_id is required in request body' },
        { status: 400 }
      );
    }

    const block = await createRecurringScheduleBlock(
      'resource',
      params.id,
      body
    );

    return NextResponse.json({ block });
  } catch (error: any) {
    console.error('[Hapio] Failed to create recurring schedule block', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create recurring schedule block';
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

