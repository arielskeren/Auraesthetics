import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAvailability } from '@/lib/hapioClient';
import { getHapioServiceConfig } from '@/lib/hapioServiceCatalog';
import { getOutlookBusySlots } from '@/lib/outlookClient';
import { getSqlClient } from '@/app/_utils/db';

type CacheKey = string;

interface CacheEntry {
  expiresAt: number;
  value: Response;
}

const availabilityCache = new Map<CacheKey, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 30_000;
const MAX_CACHE_TTL_MS = 60_000;
// Outlook sync can be disabled by setting OUTLOOK_SYNC_ENABLED=false
const OUTLOOK_SYNC_ENABLED = process.env.OUTLOOK_SYNC_ENABLED !== 'false';

// Track in-flight requests to coalesce identical concurrent fetches
const inflightRequests = new Map<CacheKey, Promise<NextResponse>>();

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
 * 
 * We format dates in UTC with +00:00 offset since JavaScript Date objects are UTC-based internally.
 */
function formatDateForHapio(date: Date, timeZone: string = 'UTC'): string {
  // Render date components in the provided IANA timeZone
  // and compute the correct numeric offset (e.g., -05:00).
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      // timeZoneName: 'shortOffset' would be ideal, but not universally supported.
    });
    const parts = fmt.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');

    // Derive offset by comparing the same wall time vs UTC.
    // Approach: get the clock components in the zone and UTC, then compute offset.
    const utc = {
      y: date.getUTCFullYear(),
      m: date.getUTCMonth(),
      d: date.getUTCDate(),
      hh: date.getUTCHours(),
      mm: date.getUTCMinutes(),
      ss: date.getUTCSeconds(),
    };
    // Build a Date from the local parts interpreted as if they were UTC, then diff.
    const pseudoUtc = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ));
    // Offset minutes = (pseudoUtc - actualUTC)
    const diffMs = pseudoUtc.getTime() - Date.UTC(utc.y, utc.m, utc.d, utc.hh, utc.mm, utc.ss);
    const offsetMinutes = Math.round(diffMs / 60000);
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const offH = String(Math.floor(abs / 60)).padStart(2, '0');
    const offM = String(abs % 60).padStart(2, '0');
    const offset = `${sign}${offH}:${offM}`;

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
  } catch {
    // Fallback to UTC if any error occurs
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}+00:00`;
  }
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

    // Resolve Hapio identifiers
    // 1) If explicit query params provided, use them
    // 2) Else, look up service by slug in Neon DB to get hapio_service_id
    // 3) Else, fall back to static mapping file
    let resolvedServiceId: string | null = explicitServiceId ?? null;
    let resolvedLocationId: string | null = explicitLocationId ?? null;
    let resolvedResourceId: string | null = null;

    let dbLookupError: string | null = null;
    if (!resolvedServiceId && slug) {
      try {
        const sql = getSqlClient();
        const rows = await sql`
          SELECT hapio_service_id 
          FROM services 
          WHERE slug = ${slug}
          LIMIT 1
        ` as Array<{ hapio_service_id: string | null }>;
        const dbServiceId = rows?.[0]?.hapio_service_id || null;
        if (dbServiceId) {
          resolvedServiceId = dbServiceId;
        }
      } catch (e: any) {
        dbLookupError = e?.message || 'DB lookup failed';
        // continue; we'll fall back to the static map
      }
    }

    if (!resolvedServiceId || !resolvedLocationId) {
      const config = slug ? getHapioServiceConfig(slug) : null;
      resolvedServiceId = resolvedServiceId ?? (config?.serviceId ?? null);
      resolvedLocationId =
        resolvedLocationId ?? (config?.locationId ?? process.env.HAPIO_DEFAULT_LOCATION_ID ?? null);
      resolvedResourceId = config?.resourceId ?? null;
    }

    if (!resolvedServiceId) {
      return NextResponse.json(
        {
          error: 'Missing Hapio service mapping. Provide a valid slug or serviceId.',
          slug: slug ?? null,
          notes: dbLookupError ? `DB lookup error: ${dbLookupError}` : undefined,
        },
        { status: 400 }
      );
    }

    if (!resolvedLocationId) {
      return NextResponse.json(
        {
          error: 'Missing Hapio location mapping. Provide a locationId for the service.',
          slug: slug ?? null,
          serviceId: resolvedServiceId,
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
      serviceId: resolvedServiceId,
      locationId: resolvedLocationId,
      resourceId: resolvedResourceId ?? '',
      fromIso,
      toIso,
      page: page ?? '',
      perPage: perPage ?? '',
    });

    const cacheTtl = resolveCacheTtl();
    // If we have a cached response, return it (and support If-None-Match)
    const cachedResponse = getFromCache(cacheKey);
    if (cachedResponse) {
      const etag = cachedResponse.headers.get('ETag');
      const ifNoneMatch = request.headers.get('if-none-match');
      const isNotModified = etag && ifNoneMatch && ifNoneMatch === etag;
      const cloned = cachedResponse.clone();
      cloned.headers.set('x-hapio-cache', 'hit');
      cloned.headers.set('x-inflight-coalesced', '0');
      if (isNotModified) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            ETag: etag as string,
            'X-Hapio-Cache': 'hit',
            'x-hapio-cache': 'hit',
            'x-inflight-coalesced': '0',
          },
        });
      }
      return cloned;
    }

    // Coalesce identical in-flight requests
    if (inflightRequests.has(cacheKey)) {
      const resp = await inflightRequests.get(cacheKey)!;
      const cloned = resp.clone();
      cloned.headers.set('x-hapio-cache', 'miss');
      cloned.headers.set('x-inflight-coalesced', '1');
      return cloned;
    }

    let availability;
    // Attempt 1: use resolvedServiceId (DB mapping or explicit). On 404, retry with static map ID if different.
    const staticConfig = slug ? getHapioServiceConfig(slug) : null;
    const staticServiceId = staticConfig?.serviceId ?? null;
    let firstError: any = null;
    const fetchAvailability = async () => {
      availability = await getAvailability({
        serviceId: resolvedServiceId as string,
        from: fromIso,
        to: toIso,
        locationId: resolvedLocationId as string,
        resourceId: resolvedResourceId ?? undefined,
        perPage,
        page,
      });
      
      // Log availability response for debugging
      console.log('[Hapio] Availability response:', {
        serviceIdTried: resolvedServiceId,
        slotsCount: availability.slots?.length ?? 0,
        pagination: availability.pagination,
        firstSlot: availability.slots?.[0] ?? null,
      });
      return availability;
    };

    const inflightPromise = (async () => {
      try {
        await fetchAvailability();
      } catch (error: any) {
      firstError = error;
      const status = Number(error?.response?.status || error?.status);
      const isNotFound = status === 404;
      const canRetryWithStatic =
        isNotFound &&
        staticServiceId &&
        staticServiceId !== resolvedServiceId;
      if (canRetryWithStatic) {
        try {
          console.warn('[Hapio] Availability 404 for DB serviceId. Retrying with static map serviceId.', {
            slug,
            dbServiceId: resolvedServiceId,
            staticServiceId,
          });
            availability = await getAvailability({
              serviceId: staticServiceId as string,
            from: fromIso,
            to: toIso,
              locationId: resolvedLocationId as string,
            resourceId: resolvedResourceId ?? undefined,
            perPage,
            page,
          });
          // Update resolvedServiceId to static for downstream payload consistency
          resolvedServiceId = staticServiceId;
          console.log('[Hapio] Availability response (retry with static):', {
            serviceIdTried: resolvedServiceId,
            slotsCount: availability.slots?.length ?? 0,
          });
        } catch (retryErr: any) {
          // Return detailed diagnostics
          const retryStatus = Number(retryErr?.response?.status || retryErr?.status);
          const diag = {
            error: 'Failed to retrieve availability from Hapio',
            primary: {
              serviceIdTried: resolvedServiceId,
              status: status || null,
              details: firstError?.response?.data || firstError?.response || null,
            },
            retry: {
              serviceIdTried: staticServiceId,
              status: retryStatus || null,
              details: retryErr?.response?.data || retryErr?.response || null,
            },
            hint: 'Your Neon DB hapio_service_id may be out of sync with the current Hapio project. Re-sync services or update hapio_service_id.',
          };
          const httpStatus = retryStatus || status || 500;
          return NextResponse.json(diag, { status: httpStatus });
        }
      } else {
        const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve availability from Hapio';
        return NextResponse.json(
          {
            error: message,
            details: error?.response?.data || error?.response || null,
            serviceIdTried: resolvedServiceId,
            hint: isNotFound
              ? 'Service ID not found in Hapio. Ensure hapio_service_id matches the active Hapio project, or re-sync.'
              : undefined,
          },
          { status: status || 500 }
        );
      }
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
      const slotsArray = Array.isArray(availability?.slots) ? availability!.slots : [];
      const filteredSlotEntities =
        outlookBusy.length > 0 && !outlookError
          ? slotsArray.filter((slot) => {
              return outlookBusy.every((block) => {
                if (!block.start || !block.end) return true; // Skip invalid blocks
                return !intervalsOverlap(slot.startsAt, slot.endsAt, block.start, block.end);
              });
            })
          : slotsArray;

      // Log filtering results
      console.log('[Hapio] Filtering results:', {
        originalSlotsCount: slotsArray.length,
        filteredSlotsCount: filteredSlotEntities.length,
        outlookBusyBlocks: outlookBusy.length,
        outlookError: outlookError,
      });

      const payload = {
        service: {
          slug: slug ?? null,
          serviceId: resolvedServiceId,
          locationId: resolvedLocationId,
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
        pagination: availability?.pagination ?? null,
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

      // Compute a stable ETag for payload
      const etag = crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
      const response = NextResponse.json(payload, {
        headers: {
          'Cache-Control': `private, max-age=${Math.floor(cacheTtl / 1000)}`,
          'X-Hapio-Cache': 'miss',
          ETag: etag,
          'x-inflight-coalesced': '0',
        },
      });

      setCache(cacheKey, response.clone(), cacheTtl);

      return response;
    })();

    inflightRequests.set(cacheKey, inflightPromise);
    const finalResp = await inflightPromise;
    // Clean up inflight
    inflightRequests.delete(cacheKey);
    return finalResp;
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


