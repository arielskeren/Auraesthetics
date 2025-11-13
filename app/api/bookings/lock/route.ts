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

function serializeDate(date: Date): string {
  return date.toISOString();
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

    const serviceConfig = serviceSlug ? getHapioServiceConfig(serviceSlug) : null;
    const hapioServiceId = explicitServiceId ?? serviceConfig?.serviceId ?? null;
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
      startsAt: serializeDate(startDate),
      endsAt: serializeDate(endDate),
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
        ${serializeDate(startDate)},
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


