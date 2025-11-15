import { NextRequest, NextResponse } from 'next/server';
import { listRecurringSchedules, getRecurringSchedule } from '@/lib/hapioClient';
import { listRecurringScheduleBlocks, getRecurringScheduleBlock } from '@/lib/hapioClient';

/**
 * Diagnostic endpoint to inspect Hapio API response structures
 * This helps us understand the exact field names and formats Hapio uses
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resource_id');
    const scheduleId = searchParams.get('schedule_id');
    const blockId = searchParams.get('block_id');

    if (!resourceId) {
      return NextResponse.json(
        { error: 'resource_id query parameter is required' },
        { status: 400 }
      );
    }

    const results: Record<string, unknown> = {
      resource_id: resourceId,
      timestamp: new Date().toISOString(),
    };

    // 1. Try to list recurring schedules
    try {
      // Get raw response directly from API to see all fields
      const rawSchedulesResponse = await fetch(
        `https://eu-central-1.hapio.net/v1/resources/${resourceId}/recurring-schedules`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.HAPIO_API_TOKEN}`,
            'Accept': 'application/json',
          },
        }
      );
      const rawSchedulesData = await rawSchedulesResponse.json();
      
      const schedules = await listRecurringSchedules('resource', resourceId);
      results.recurring_schedules = {
        count: schedules.data?.length || 0,
        sample: schedules.data?.[0] || null,
        full_response_structure: schedules.data?.[0] ? Object.keys(schedules.data[0]) : [],
        raw_api_response_sample: rawSchedulesData.data?.[0] || null,
        raw_api_all_fields: rawSchedulesData.data?.[0] ? Object.keys(rawSchedulesData.data[0]) : [],
      };
      
      // If we have a schedule, try to get it individually - get raw response
      if (schedules.data?.[0]?.id) {
        const scheduleId = schedules.data[0].id;
        const rawScheduleResponse = await fetch(
          `https://eu-central-1.hapio.net/v1/resources/${resourceId}/recurring-schedules/${scheduleId}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.HAPIO_API_TOKEN}`,
              'Accept': 'application/json',
            },
          }
        );
        const rawScheduleData = await rawScheduleResponse.json();
        
        const schedule = await getRecurringSchedule('resource', resourceId, scheduleId);
        results.recurring_schedule_detail = {
          id: schedule.id,
          all_fields: Object.keys(schedule),
          full_object: schedule,
          raw_api_response: rawScheduleData,
          raw_api_all_fields: Object.keys(rawScheduleData),
        };
      }
    } catch (error: any) {
      results.recurring_schedules_error = {
        message: error.message,
        status: error.status,
      };
    }

    // 2. Try to list recurring schedule blocks
    try {
      const recurringSchedules = results.recurring_schedules as any;
      const scheduleIdForBlocks = scheduleId || recurringSchedules?.sample?.id;
      
      if (scheduleIdForBlocks) {
        // Get raw response directly from API
        const rawBlocksResponse = await fetch(
          `https://eu-central-1.hapio.net/v1/resources/${resourceId}/recurring-schedules/${scheduleIdForBlocks}/schedule-blocks`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.HAPIO_API_TOKEN}`,
              'Accept': 'application/json',
            },
          }
        );
        const rawBlocksData = await rawBlocksResponse.json();
        
        const blocks = await listRecurringScheduleBlocks(
          'resource',
          resourceId,
          { recurring_schedule_id: scheduleIdForBlocks as string }
        );
        
        results.recurring_schedule_blocks = {
          count: blocks.data?.length || 0,
          sample: blocks.data?.[0] || null,
          full_response_structure: blocks.data?.[0] ? Object.keys(blocks.data[0]) : [],
          raw_api_response_sample: rawBlocksData.data?.[0] || null,
          raw_api_all_fields: rawBlocksData.data?.[0] ? Object.keys(rawBlocksData.data[0]) : [],
        };

        // If we have a block, try to get it individually - get raw response
        if (blocks.data?.[0]?.id) {
          const blockId = blocks.data[0].id;
          const rawBlockResponse = await fetch(
            `https://eu-central-1.hapio.net/v1/resources/${resourceId}/recurring-schedules/${scheduleIdForBlocks}/schedule-blocks/${blockId}`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.HAPIO_API_TOKEN}`,
                'Accept': 'application/json',
              },
            }
          );
          const rawBlockData = await rawBlockResponse.json();
          
          const block = await getRecurringScheduleBlock(
            'resource',
            resourceId,
            blockId,
            scheduleIdForBlocks
          );
          results.recurring_schedule_block_detail = {
            id: block.id,
            all_fields: Object.keys(block),
            full_object: block,
            weekday_value: block.weekday ?? block.day_of_week,
            weekday_type: typeof (block.weekday ?? block.day_of_week),
            start_time_format: block.start_time,
            end_time_format: block.end_time,
            start_time_length: block.start_time?.length,
            end_time_length: block.end_time?.length,
            raw_api_response: rawBlockData,
            raw_api_all_fields: Object.keys(rawBlockData),
            raw_weekday_value: rawBlockData.weekday ?? rawBlockData.day_of_week,
            raw_start_time: rawBlockData.start_time,
            raw_end_time: rawBlockData.end_time,
          };
        }
      } else {
        results.recurring_schedule_blocks = {
          note: 'No schedule_id provided and no schedules found to use',
        };
      }
    } catch (error: any) {
      results.recurring_schedule_blocks_error = {
        message: error.message,
        status: error.status,
        details: error.response?.data || null,
      };
    }

    // 3. Field name analysis
    results.field_analysis = {
      weekday_field_name: results.recurring_schedule_block_detail
        ? (results.recurring_schedule_block_detail as any).full_object?.weekday !== undefined
          ? 'weekday'
          : (results.recurring_schedule_block_detail as any).full_object?.day_of_week !== undefined
          ? 'day_of_week'
          : 'unknown'
        : 'unknown',
      time_format: {
        start_time_example: (results.recurring_schedule_block_detail as any)?.start_time_format || 'unknown',
        end_time_example: (results.recurring_schedule_block_detail as any)?.end_time_format || 'unknown',
        inferred_format: (results.recurring_schedule_block_detail as any)?.start_time_format
          ? (results.recurring_schedule_block_detail as any).start_time_format.includes(':')
            ? (results.recurring_schedule_block_detail as any).start_time_format.split(':').length === 3
              ? 'H:i:s'
              : 'H:i'
            : 'unknown'
          : 'unknown',
      },
    };

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    console.error('[Diagnostic] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Diagnostic failed',
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}

