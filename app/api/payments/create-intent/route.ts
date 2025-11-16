import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { createPaymentIntent } from '@/lib/stripeClient';
import { getHapioServiceConfig } from '@/lib/hapioServiceCatalog';

export async function POST(request: NextRequest) {
  try {
    const { serviceId, serviceSlug, slotStart, slotEnd, timezone, email, bookingId } =
      (await request.json()) as {
        serviceId?: string;
        serviceSlug?: string;
        slotStart: string;
        slotEnd: string;
        timezone?: string | null;
        email?: string | null;
        bookingId?: string | null;
      };

    if ((!serviceId && !serviceSlug) || !slotStart || !slotEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceId|serviceSlug, slotStart, slotEnd' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();
    let svc:
      | {
          id: string;
          slug: string;
          name: string;
          price: number | null;
          hapio_service_id: string | null;
        }
      | null = null;

    if (serviceId) {
      const rows = (await sql`
        SELECT id, slug, name, price, hapio_service_id
        FROM services
        WHERE id = ${serviceId}
        LIMIT 1
      `) as any[];
      svc = rows?.[0] ?? null;
    } else if (serviceSlug) {
      const rows = (await sql`
        SELECT id, slug, name, price, hapio_service_id
        FROM services
        WHERE slug = ${serviceSlug}
        LIMIT 1
      `) as any[];
      svc = rows?.[0] ?? null;
    }

    if (!svc) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const unitAmount =
      typeof svc.price === 'number' && Number.isFinite(svc.price)
        ? Math.round(svc.price * 100)
        : 0;

    // Resolve hapio service id for metadata
    let hapioServiceId = svc.hapio_service_id;
    if (!hapioServiceId) {
      const cfg = getHapioServiceConfig(svc.slug);
      hapioServiceId = cfg?.serviceId ?? null;
    }

    const pi = await createPaymentIntent({
      amount: unitAmount,
      currency: 'usd',
      customerEmail: email ?? null,
      metadata: {
        service_id: svc.id,
        service_slug: svc.slug,
        hapio_service_id: hapioServiceId ?? '',
        slot_start: slotStart,
        slot_end: slotEnd,
        timezone: timezone ?? '',
        hapio_booking_id: bookingId ?? '',
      },
    });

    return NextResponse.json({
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
    });
  } catch (error: any) {
    console.error('[Payments] create-intent error', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent', details: error?.message },
      { status: 500 }
    );
  }
}

