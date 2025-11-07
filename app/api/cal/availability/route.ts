import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { calRequest, getCalRateLimitRemaining } from '@/lib/calClient';
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
    const response = await calRequest<any>('get', 'slots', {
      params: {
        eventTypeId: eventType.id,
        start: startTime,
        end: endTime,
        timeZone: timezone,
      },
    });

    const rateLimitRemaining = getCalRateLimitRemaining(response.headers ?? {});
    const availabilityData = response.data?.data || {};
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

    return NextResponse.json({
      slug,
      eventTypeId: eventType.id,
      title: eventType.title,
      requiresConfirmation: eventType.requiresConfirmation,
      duration: eventType.duration,
      availability,
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

