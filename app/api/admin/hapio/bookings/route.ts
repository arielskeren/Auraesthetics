import { NextRequest, NextResponse } from 'next/server';
import { listBookings, createBooking } from '@/lib/hapioClient';
import { deduplicateRequest, getCacheKey } from '../_utils/requestDeduplication';

/**
 * Format date for Hapio API: Y-m-d\TH:i:sP format
 * Example: 2025-11-15T00:00:00+00:00 (no milliseconds, timezone offset instead of Z)
 */
function formatDateForHapio(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+00:00`;
}

/**
 * Convert YYYY-MM-DD date string to Hapio format
 * For "from" dates, use 00:00:00
 * For "to" dates, use 23:59:59
 */
function convertDateToHapioFormat(dateString: string, isEndDate: boolean = false): string {
  const date = new Date(dateString + 'T00:00:00Z');
  if (isEndDate) {
    date.setUTCHours(23, 59, 59, 0);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }
  return formatDateForHapio(date);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromRaw = searchParams.get('from');
    const toRaw = searchParams.get('to');
    const locationId = searchParams.get('location_id') ?? undefined;
    const serviceId = searchParams.get('service_id') ?? undefined;
    const resourceId = searchParams.get('resource_id') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    // Convert date strings to Hapio format (YYYY-MM-DD -> YYYY-MM-DDTHH:mm:ss+00:00)
    const from = fromRaw ? convertDateToHapioFormat(fromRaw, false) : undefined;
    const to = toRaw ? convertDateToHapioFormat(toRaw, true) : undefined;

    const cacheKey = getCacheKey({
      endpoint: 'bookings',
      from: from || '',
      to: to || '',
      locationId: locationId || '',
      serviceId: serviceId || '',
      resourceId: resourceId || '',
      status: status || '',
      page: page || '',
      perPage: perPage || '',
    });

    const response = await deduplicateRequest(cacheKey, async () => {
      return await listBookings({
        from,
        to,
        location_id: locationId,
        service_id: serviceId,
        resource_id: resourceId,
        status,
        page,
        per_page: perPage,
      });
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Hapio] Failed to list bookings', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve bookings';
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const booking = await createBooking(body);
    return NextResponse.json({ booking });
  } catch (error: any) {
    console.error('[Hapio] Failed to create booking', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create booking';
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

