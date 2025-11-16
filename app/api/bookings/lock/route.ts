import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { createPendingBooking } from '@/lib/hapioClient';
import { getHapioServiceConfig } from '@/lib/hapioServiceCatalog';
import { getServiceBySlug } from '@/lib/serviceCatalog';

type LockRequestBody = {
  serviceSlug?: string;
  serviceId?: string;
  locationId?: string;
  resourceId?: string | null;
  start: string;
  end: string;
  timezone?: string | null;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  metadata?: Record<string, unknown>;
};

const sql = getSqlClient();

function parseIso(value: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

// Format date for Hapio API: Y-m-d\\TH:i:sP (no milliseconds, with offset)
function formatDateForHapio(date: Date, timeZone: string = 'UTC'): string {
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

    // Derive numeric offset by comparing local-zone wall time vs UTC
    const utc = {
      y: date.getUTCFullYear(),
      m: date.getUTCMonth(),
      d: date.getUTCDate(),
      hh: date.getUTCHours(),
      mm: date.getUTCMinutes(),
      ss: date.getUTCSeconds(),
    };
    const pseudoUtc = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ));
    const diffMs = pseudoUtc.getTime() - Date.UTC(utc.y, utc.m, utc.d, utc.hh, utc.mm, utc.ss);
    const offsetMinutes = Math.round(diffMs / 60000);
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const offH = String(Math.floor(abs / 60)).padStart(2, '0');
    const offM = String(abs % 60).padStart(2, '0');
    const offset = `${sign}${offH}:${offM}`;

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
  } catch {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}+00:00`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LockRequestBody;

    const { serviceSlug, serviceId: explicitServiceId, locationId: explicitLocationId, resourceId, start, end } =
      body;

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Missing required fields: start, end.' },
        { status: 400 }
      );
    }

    const startDate = parseIso(start);
    const endDate = parseIso(end);

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Invalid start or end timestamp. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: '`end` must be after `start`.' },
        { status: 400 }
      );
    }

    // Resolve Hapio identifiers with DB-first strategy (to avoid mismatched projects)
    let hapioServiceId: string | null = explicitServiceId ?? null;
    if (!hapioServiceId && serviceSlug) {
      try {
        const rows = await sql`
          SELECT hapio_service_id 
          FROM services 
          WHERE slug = ${serviceSlug}
          LIMIT 1
        ` as Array<{ hapio_service_id: string | null }>;
        const dbServiceId = rows?.[0]?.hapio_service_id || null;
        if (dbServiceId) {
          hapioServiceId = dbServiceId;
        }
      } catch {
        // fall through, will use static map
      }
    }
    const serviceConfig = serviceSlug ? getHapioServiceConfig(serviceSlug) : null;
    hapioServiceId = hapioServiceId ?? serviceConfig?.serviceId ?? null;
    const hapioLocationId =
      explicitLocationId ??
      serviceConfig?.locationId ??
      process.env.HAPIO_DEFAULT_LOCATION_ID ??
      null;

    if (!hapioServiceId) {
      return NextResponse.json(
        {
          error: 'Unknown service. Provide a valid serviceSlug or serviceId.',
          serviceSlug: serviceSlug ?? null,
        },
        { status: 400 }
      );
    }

    if (!hapioLocationId) {
      return NextResponse.json(
        {
          error: 'Missing Hapio location mapping for service.',
          serviceSlug: serviceSlug ?? null,
          serviceId: hapioServiceId,
        },
        { status: 400 }
      );
    }

    const serviceDefinition = serviceSlug ? getServiceBySlug(serviceSlug) : null;
    const displayName = serviceDefinition?.name ?? serviceSlug ?? hapioServiceId;
    const internalServiceId = serviceDefinition?.slug ?? serviceSlug ?? hapioServiceId;

    const hapioBooking = await createPendingBooking({
      serviceId: hapioServiceId,
      locationId: hapioLocationId,
      startsAt: formatDateForHapio(startDate, body.timezone ?? 'UTC'),
      endsAt: formatDateForHapio(endDate, body.timezone ?? 'UTC'),
      resourceId: resourceId ?? serviceConfig?.resourceId,
      metadata: {
        source: 'website',
        serviceSlug: serviceSlug ?? null,
        timezone: body.timezone ?? null,
        customer: body.customer ?? null,
        lockedAt: new Date().toISOString(),
      },
      isTemporary: true,
    });

    const customer = body.customer ?? {};
    const normalizedCustomer = {
      name: customer?.name?.trim() || null,
      email: customer?.email?.trim() || null,
      phone: customer?.phone?.trim() || null,
    };

    const metadataPayload = {
      ...body.metadata,
      serviceSlug: serviceSlug ?? null,
      timezone: body.timezone ?? null,
      slot: {
        start,
        end,
      },
      customer: normalizedCustomer,
    };

    await sql`
      INSERT INTO bookings (
        hapio_booking_id,
        service_id,
        service_name,
        client_name,
        client_email,
        client_phone,
        booking_date,
        payment_status,
        metadata
      ) VALUES (
        ${hapioBooking.id},
        ${internalServiceId},
        ${displayName},
        ${normalizedCustomer.name},
        ${normalizedCustomer.email},
        ${normalizedCustomer.phone},
        ${formatDateForHapio(startDate, body.timezone ?? 'UTC')},
        ${'pending'},
        ${JSON.stringify(metadataPayload)}::jsonb
      )
      ON CONFLICT (hapio_booking_id) DO UPDATE SET
        updated_at = NOW(),
        client_name = EXCLUDED.client_name,
        client_email = EXCLUDED.client_email,
        client_phone = EXCLUDED.client_phone,
        metadata = EXCLUDED.metadata
    `;

    return NextResponse.json({
      hapioBookingId: hapioBooking.id,
      serviceId: hapioBooking.serviceId,
      locationId: hapioBooking.locationId,
      resourceId: hapioBooking.resourceId ?? null,
      startsAt: hapioBooking.startsAt,
      endsAt: hapioBooking.endsAt,
      isTemporary: hapioBooking.isTemporary,
      timezone: body.timezone ?? null,
    });
  } catch (error: any) {
    console.error('[Hapio] Failed to lock booking', error);
    const status = Number(error?.status) || Number(error?.response?.status) || 500;
    const message = typeof error?.message === 'string' ? error.message : 'Failed to lock booking';
    return NextResponse.json(
      {
        error: 'Failed to create Hapio pending booking.',
        message,
      },
      { status }
    );
  }
}


