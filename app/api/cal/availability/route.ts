import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getCalClient, getCalRateLimitRemaining } from '@/lib/calClient';
const EVENT_TYPES_PATH = path.join(process.cwd(), 'docs', 'cal-event-types.json');

type CalEventType = {
  id: number;
  slug: string;
  title: string;
  hidden: boolean;
  duration: number | null;
  requiresConfirmation: boolean;
  metadata?: {
    description?: string | null;
    price?: number | null;
    currency?: string | null;
  };
};

type AvailabilitySlot = {
  slot: string;
  duration?: number | null;
  attendeeTimezone?: string | null;
};

type ScheduleAvailabilityBlock = {
  day?: number | null;
  weekday?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  start?: number | null;
  end?: number | null;
};

type ScheduleResponse = {
  id?: number | null;
  timeZone?: string | null;
  timezone?: string | null;
  availability?: ScheduleAvailabilityBlock[] | null;
  workingHours?: ScheduleAvailabilityBlock[] | null;
};

interface EventTypeCache {
  fetchedAt: string;
  count: number;
  eventTypes: CalEventType[];
}

let cachedEventTypes: EventTypeCache | null = null;

function loadEventTypes(): EventTypeCache {
  if (cachedEventTypes) {
    return cachedEventTypes;
  }

  try {
    const fileContents = fs.readFileSync(EVENT_TYPES_PATH, 'utf8');
    const parsed = JSON.parse(fileContents) as EventTypeCache;
    cachedEventTypes = parsed;
    return parsed;
  } catch (error) {
    console.error('Failed to load Cal event types file:', error);
    return {
      fetchedAt: new Date(0).toISOString(),
      count: 0,
      eventTypes: [],
    };
  }
}

function buildIsoRange(start: Date, numberOfDays: number) {
  const startOfDay = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  ));

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + numberOfDays);

  return {
    startTime: startOfDay.toISOString(),
    endTime: endOfDay.toISOString(),
  };
}

const scheduleCache = new Map<
  number,
  {
    allowedWeekdays: Set<number>;
    timezone?: string | null;
    fetchedAt: number;
  }
>();

const WEEKDAY_LABEL_TO_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function normalizeDayValue(block: ScheduleAvailabilityBlock): number | null {
  if (typeof block.day === 'number' && block.day >= 0 && block.day <= 6) {
    return block.day;
  }

  if (typeof block.weekday === 'number' && block.weekday >= 0 && block.weekday <= 6) {
    return block.weekday;
  }

  if (typeof (block as any)?.day === 'string') {
    const key = ((block as any).day as string).toLowerCase();
    if (key in WEEKDAY_LABEL_TO_INDEX) {
      return WEEKDAY_LABEL_TO_INDEX[key];
    }
  }

  if (typeof (block as any)?.weekday === 'string') {
    const key = ((block as any).weekday as string).toLowerCase();
    if (key in WEEKDAY_LABEL_TO_INDEX) {
      return WEEKDAY_LABEL_TO_INDEX[key];
    }
  }

  return null;
}

function detectWeekdayFromDate(isoString: string, timeZone: string): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone,
    });
    const label = formatter.format(new Date(isoString)).toLowerCase();
    if (label in WEEKDAY_LABEL_TO_INDEX) {
      return WEEKDAY_LABEL_TO_INDEX[label];
    }
  } catch (error) {
    console.warn('Failed to derive weekday from slot for timezone', timeZone, error);
  }
  return null;
}

async function resolveAllowedWeekdays(
  client: ReturnType<typeof getCalClient>,
  eventTypeId: number
) {
  const now = Date.now();
  const cached = scheduleCache.get(eventTypeId);
  if (cached && now - cached.fetchedAt < 1000 * 60 * 5) {
    return cached;
  }

  try {
    const eventResponse = await client.get(`event-types/${eventTypeId}`);
    const eventPayload = (eventResponse.data?.data ?? eventResponse.data ?? {}) as any;

    const scheduleId: number | null =
      eventPayload?.schedule?.id ??
      eventPayload?.scheduleId ??
      eventPayload?.defaultScheduleId ??
      eventPayload?.users?.[0]?.defaultScheduleId ??
      eventPayload?.users?.[0]?.scheduleId ??
      null;

    if (!scheduleId) {
      return null;
    }

    const scheduleResponse = await client.get(`schedules/${scheduleId}`);
    const schedulePayload = (scheduleResponse.data?.data ?? scheduleResponse.data ?? {}) as ScheduleResponse;

    const blocks =
      schedulePayload?.availability ??
      schedulePayload?.workingHours ??
      (Array.isArray((schedulePayload as any)?.slots) ? (schedulePayload as any).slots : null) ??
      [];

    if (!Array.isArray(blocks) || blocks.length === 0) {
      const entry = {
        allowedWeekdays: new Set<number>(),
        timezone: schedulePayload?.timeZone ?? schedulePayload?.timezone ?? null,
        fetchedAt: now,
      };
      scheduleCache.set(eventTypeId, entry);
      return entry;
    }

    const allowedWeekdays = new Set<number>();
    for (const block of blocks) {
      const normalized = normalizeDayValue(block);
      if (normalized !== null) {
        allowedWeekdays.add(normalized);
      }
    }

    const entry = {
      allowedWeekdays,
      timezone: schedulePayload?.timeZone ?? schedulePayload?.timezone ?? null,
      fetchedAt: now,
    };
    scheduleCache.set(eventTypeId, entry);
    return entry;
  } catch (error) {
    console.warn('Unable to resolve schedule for Cal.com event type', eventTypeId, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const startParam = searchParams.get('start');
  const daysParam = searchParams.get('days');
  const timezone = searchParams.get('timezone') || 'America/New_York';

  if (!slug) {
    return NextResponse.json(
      { error: 'Missing required parameter: slug' },
      { status: 400 }
    );
  }

  const eventTypes = loadEventTypes();
  const eventType = eventTypes.eventTypes.find((event) => event.slug === slug);

  if (!eventType) {
    return NextResponse.json(
      { error: `No Cal.com event type found for slug: ${slug}` },
      { status: 404 }
    );
  }

  const numberOfDays = Math.max(1, Math.min(parseInt(daysParam || '7', 10) || 7, 30));
  const startDate = startParam ? new Date(startParam) : new Date();
  const { startTime, endTime } = buildIsoRange(startDate, numberOfDays);

  try {
    const client = getCalClient();
    const [slotsResponse, scheduleInfo] = await Promise.all([
      client.get('slots', {
      params: {
        eventTypeId: eventType.id,
        start: startTime,
        end: endTime,
        timeZone: timezone,
      },
      }),
      resolveAllowedWeekdays(client, eventType.id),
    ]);

    const rateLimitRemaining = getCalRateLimitRemaining(slotsResponse.headers ?? {});
    const availabilityData = slotsResponse.data?.data || {};
    const availability: AvailabilitySlot[] = [];

    Object.entries(availabilityData).forEach(([dateKey, slots]) => {
      if (Array.isArray(slots)) {
        slots.forEach((slot: any) => {
          if (slot?.start) {
            availability.push({
              slot: slot.start,
              duration: eventType.duration ?? null,
              attendeeTimezone: timezone,
            });
          }
        });
      }
    });

    let filteredAvailability = availability;

    if (scheduleInfo && scheduleInfo.allowedWeekdays.size > 0) {
      const scheduleTimezone = scheduleInfo.timezone || timezone;
      filteredAvailability = availability.filter((slot) => {
        const weekday = detectWeekdayFromDate(slot.slot, scheduleTimezone);
        if (weekday === null) {
          return true;
        }
        return scheduleInfo.allowedWeekdays.has(weekday);
      });
    }

    return NextResponse.json({
      slug,
      eventTypeId: eventType.id,
      title: eventType.title,
      requiresConfirmation: eventType.requiresConfirmation,
      duration: eventType.duration,
      availability: filteredAvailability,
      meta: {
        fetchedAt: new Date().toISOString(),
        startTime,
        endTime,
        timezone,
        rateLimitRemaining:
          typeof rateLimitRemaining !== 'undefined' ? Number(rateLimitRemaining) : null,
        source: 'cal.com',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch Cal.com availability:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    return NextResponse.json(
      {
        error: 'Failed to fetch availability from Cal.com',
        details: error.response?.data || error.message,
      },
      { status }
    );
  }
}

