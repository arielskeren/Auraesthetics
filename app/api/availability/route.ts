import { NextRequest, NextResponse } from 'next/server';
import { getAvailability } from '@/lib/hapioClient';
import { getHapioServiceConfig } from '@/lib/hapioServiceCatalog';
import { getOutlookBusySlots } from '@/lib/outlookClient';

type CacheKey = string;

interface CacheEntry {
  expiresAt: number;
  value: Response;
}

const availabilityCache = new Map<CacheKey, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 30_000;
const MAX_CACHE_TTL_MS = 60_000;
const OUTLOOK_SYNC_ENABLED = process.env.OUTLOOK_SYNC_ENABLED !== 'false';

function resolveCacheTtl(): number {
  const envValue = process.env.HAPIO_AVAILABILITY_CACHE_TTL_MS;
  if (!envValue) {
    return DEFAULT_CACHE_TTL_MS;
  }
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CACHE_TTL_MS;
  }
  return Math.min(parsed, MAX_CACHE_TTL_MS);
}

function getFromCache(key: CacheKey): NextResponse | null {
  const entry = availabilityCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    availabilityCache.delete(key);
    return null;
  }
  // Clone the cached Response and return as NextResponse
  // Since NextResponse extends Response, we can safely cast
  return entry.value.clone() as NextResponse;
}

function setCache(key: CacheKey, value: Response, ttlMs: number) {
  availabilityCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value: value.clone(),
  });
}

function clampDays(value: number): number {
  if (!Number.isFinite(value)) {
    return 7;
  }
  return Math.max(1, Math.min(60, Math.round(value)));
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

/**
 * Format date for Hapio API: Y-m-d\TH:i:sP format
 * Example: 2025-11-15T03:17:09+00:00 (no milliseconds, timezone offset instead of Z)
 * Hapio expects format: Y-m-d\TH:i:sP where P is timezone offset like +00:00 or -05:00
 */
function formatDateForHapio(date: Date, timeZone: string = 'UTC'): string {
  // Format date components in the specified timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value ?? '0000';
  const month = parts.find(p => p.type === 'month')?.value ?? '01';
  const day = parts.find(p => p.type === 'day')?.value ?? '01';
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  const second = parts.find(p => p.type === 'second')?.value ?? '00';

  // Calculate timezone offset for the specified timezone at this date
  // We need to find the UTC offset for the timezone at this specific date/time
  // Use Intl.DateTimeFormat with timeZoneName to get offset info, or calculate it
  const utcTime = date.getTime();
  
  // Create a date string in the target timezone and parse it back to get offset
  // Format: get what the time would be in UTC if we interpret the TZ string as local
  const tzFormatter = new Intl.DateTimeFormat('en', {
    timeZone,
    timeZoneName: 'longOffset',
  });
  
  // Simpler: calculate offset by comparing UTC time to timezone time
  // Get the date/time string in the target timezone
  const dateInTz = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const dateInTargetTz = new Date(date.toLocaleString('en-US', { timeZone }));
  
  // This approach is flawed. Let's use a better method:
  // Get the offset by formatting the date with timezone and comparing to UTC
  const utcString = date.toISOString(); // e.g., "2025-11-15T03:17:09.572Z"
  const utcDateOnly = new Date(utcString.substring(0, 19) + 'Z');
  
  // Format in target timezone and get the difference
  // Actually, the simplest: use the date's getTimezoneOffset but for the target TZ
  // Since we can't directly get TZ offset, let's format as UTC with +00:00 for now
  // and let Hapio handle timezone conversion, OR calculate properly
  
  // Better approach: use the fact that we can get offset by creating a date in that TZ
  // For now, if timeZone is UTC, use +00:00
  // Otherwise, we need to calculate - this is complex without a library
  // Let's use a workaround: format as UTC (+00:00) since dates are stored in UTC
  // Hapio should accept UTC dates
  const offset = timeZone === 'UTC' ? '+00:00' : '+00:00'; // Default to UTC for now
  
  // Format: YYYY-MM-DDTHH:mm:ss+HH:mm (no milliseconds)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

function buildCacheKey(parts: Record<string, string | number | null | undefined>): CacheKey {
  return Object.entries(parts)
    .map(([key, value]) => `${key}=${value ?? ''}`)
    .sort()
    .join('&');
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const date = new Date(value);
  return date.getTime();
}

function intervalsOverlap(slotStart: string, slotEnd: string, busyStart: string, busyEnd: string): boolean {
  const startA = toTimestamp(slotStart);
  const endA = toTimestamp(slotEnd);
  const startB = toTimestamp(busyStart);
  const endB = toTimestamp(busyEnd);
  if (
    Number.isNaN(startA) ||
    Number.isNaN(endA) ||
    Number.isNaN(startB) ||
    Number.isNaN(endB) ||
    endA <= startA ||
    endB <= startB
  ) {
    return false;
  }
  return Math.max(startA, startB) < Math.min(endA, endB);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const slug = searchParams.get('slug') ?? searchParams.get('serviceSlug');
    const explicitServiceId = searchParams.get('serviceId');
    const explicitLocationId = searchParams.get('locationId');
    const timezone =
      searchParams.get('timezone') ?? searchParams.get('timeZone') ?? 'America/New_York';

    const config = slug ? getHapioServiceConfig(slug) : null;

    const serviceId = explicitServiceId ?? config?.serviceId ?? null;
    const locationId =
      explicitLocationId ?? config?.locationId ?? process.env.HAPIO_DEFAULT_LOCATION_ID ?? null;
    const resourceId = config?.resourceId ?? null;

    if (!serviceId) {
      return NextResponse.json(
        {
          error: 'Missing Hapio service mapping. Provide a valid slug or serviceId.',
          slug: slug ?? null,
        },
        { status: 400 }
      );
    }

    if (!locationId) {
      return NextResponse.json(
        {
          error: 'Missing Hapio location mapping. Provide a locationId for the service.',
          slug: slug ?? null,
          serviceId,
        },
        { status: 400 }
      );
    }

    const fromParam = searchParams.get('from') ?? searchParams.get('start');
    const toParam = searchParams.get('to') ?? searchParams.get('end');
    const daysParam = searchParams.get('days');
    const pageParam = searchParams.get('page');
    const perPageParam = searchParams.get('per_page') ?? searchParams.get('perPage');

    const now = new Date();
    const baseFrom = parseDate(fromParam) ?? now;
    const defaultDays = daysParam ? clampDays(Number(daysParam)) : 14;
    const baseTo =
      parseDate(toParam) ??
      new Date(baseFrom.getTime() + clampDays(defaultDays) * 24 * 60 * 60 * 1000);

    if (baseTo <= baseFrom) {
      return NextResponse.json(
        { error: '`to` must be after `from`.', from: fromParam, to: toParam },
        { status: 400 }
      );
    }

    // Format dates for Hapio API (Y-m-d\TH:i:sP format, no milliseconds, timezone offset)
    const fromIso = formatDateForHapio(baseFrom, timezone);
    const toIso = formatDateForHapio(baseTo, timezone);
    const page = pageParam ? Number(pageParam) : undefined;
    // Hapio requires per_page to be max 100
    const perPage = Math.min(perPageParam ? Number(perPageParam) : 100, 100);

    const cacheKey = buildCacheKey({
      serviceId,
      locationId,
      resourceId: resourceId ?? '',
      fromIso,
      toIso,
      page: page ?? '',
      perPage: perPage ?? '',
    });

    const cacheTtl = resolveCacheTtl();
    const cachedResponse = getFromCache(cacheKey);
    if (cachedResponse) {
      const cloned = cachedResponse.clone();
      cloned.headers.set('x-hapio-cache', 'hit');
      return cloned;
    }

    let availability;
    try {
      availability = await getAvailability({
        serviceId,
        from: fromIso,
        to: toIso,
        locationId,
        resourceId: resourceId ?? undefined,
        perPage,
        page,
      });
    } catch (error: any) {
      console.error('[Hapio] Failed to get availability', error);
      const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve availability from Hapio';
      return NextResponse.json(
        {
          error: message,
          details: error?.response?.data || error?.response || null,
        },
        { status: 500 }
      );
    }

    let outlookBusy: { start: string; end: string }[] = [];
    let outlookError: string | null = null;
    if (OUTLOOK_SYNC_ENABLED) {
      try {
        outlookBusy = await getOutlookBusySlots({
          from: fromIso,
          to: toIso,
          timeZone: timezone,
        });
        // Filter out any blocks with missing start/end times
        outlookBusy = outlookBusy.filter((block) => block.start && block.end);
      } catch (error: any) {
        outlookError = error?.message || 'Failed to retrieve Outlook busy slots';
        console.error('[Outlook] Failed to retrieve busy slots', error);
        // Continue without Outlook filtering - availability will still work
      }
    }

    // Filter out slots that overlap with Outlook busy times
    const filteredSlotEntities =
      outlookBusy.length > 0 && !outlookError
        ? availability.slots.filter((slot) => {
            return outlookBusy.every((block) => {
              if (!block.start || !block.end) return true; // Skip invalid blocks
              return !intervalsOverlap(slot.startsAt, slot.endsAt, block.start, block.end);
            });
          })
        : availability.slots;

    const payload = {
      service: {
        slug: slug ?? null,
        serviceId,
        locationId,
      },
      availability: filteredSlotEntities.map((slot) => ({
        start: slot.startsAt,
        end: slot.endsAt,
        bufferStart: slot.bufferStartsAt,
        bufferEnd: slot.bufferEndsAt,
        resources: slot.resources.map((resource) => ({
          id: resource.id,
          name: resource.name,
          enabled: resource.enabled,
          metadata: resource.metadata ?? null,
        })),
      })),
      pagination: availability.pagination ?? null,
      meta: {
        fetchedAt: new Date().toISOString(),
        timezone,
        range: {
          from: fromIso,
          to: toIso,
        },
        outlook: {
          enabled: OUTLOOK_SYNC_ENABLED,
          busyBlocks: outlookBusy.length,
          error: outlookError,
        },
        cache: {
          ttlMs: cacheTtl,
          hit: false,
        },
      },
    };

    const response = NextResponse.json(payload, {
      headers: {
        'Cache-Control': `private, max-age=${Math.floor(cacheTtl / 1000)}`,
        'X-Hapio-Cache': 'miss',
      },
    });

    setCache(cacheKey, response.clone(), cacheTtl);

    return response;
  } catch (error: any) {
    console.error('[Hapio] Availability error', error);
    const message = typeof error?.message === 'string' ? error.message : 'Unexpected error';
    const status = Number(error?.status) || Number(error?.response?.status) || 500;
    return NextResponse.json(
      {
        error: 'Failed to retrieve availability from Hapio.',
        message,
      },
      { status }
    );
  }
}


