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

    const fromIso = toIsoString(baseFrom);
    const toIso = toIsoString(baseTo);
    const page = pageParam ? Number(pageParam) : undefined;
    const perPage = perPageParam ? Number(perPageParam) : 250;

    const cacheKey = buildCacheKey({
      serviceId,
      locationId,
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

    const availability = await getAvailability({
      serviceId,
      from: fromIso,
      to: toIso,
      locationId,
      perPage,
      page,
    });

    let outlookBusy: { start: string; end: string }[] = [];
    if (OUTLOOK_SYNC_ENABLED) {
      try {
        outlookBusy = await getOutlookBusySlots({
          from: fromIso,
          to: toIso,
          timeZone: timezone,
        });
      } catch (error) {
        console.error('[Outlook] Failed to retrieve busy slots', error);
      }
    }

    const filteredSlotEntities =
      outlookBusy.length > 0
        ? availability.slots.filter(
            (slot) =>
              outlookBusy.every((block) => !intervalsOverlap(slot.startsAt, slot.endsAt, block.start, block.end))
          )
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


