import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { createPaymentIntent } from '@/lib/stripeClient';
import { getHapioServiceConfig } from '@/lib/hapioServiceCatalog';

export async function POST(request: NextRequest) {
  try {
    const { serviceId, serviceSlug, slotStart, slotEnd, timezone, email, bookingId, amountCents } =
      (await request.json()) as {
        serviceId?: string;
        serviceSlug?: string;
        slotStart: string;
        slotEnd: string;
        timezone?: string | null;
        email?: string | null;
        bookingId?: string | null;
        amountCents?: number | null;
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

    // Determine amount in cents:
    // 1) Use explicit amountCents from client (e.g., deposit or discounted amount) if >= Stripe min.
    // 2) Else fall back to DB price * 100.
    let unitAmount = 0;
    if (typeof amountCents === 'number' && Number.isFinite(amountCents)) {
      unitAmount = Math.round(Math.max(0, amountCents));
    }
    if (unitAmount <= 0) {
      const fromDb =
        typeof svc.price === 'number' && Number.isFinite(svc.price)
          ? Math.round(svc.price * 100)
          : 0;
      unitAmount = fromDb;
    }

    // Enforce Stripe minimum (USD = 50 cents). If below, return helpful error.
    const MIN_USD_CENTS = 50;
    if (unitAmount < MIN_USD_CENTS) {
      return NextResponse.json(
        {
          error:
            'Calculated amount is below the minimum chargeable amount. Please ensure the service has a price or provide a valid amount.',
          details: {
            providedAmountCents: amountCents ?? null,
            dbPriceCents: typeof svc.price === 'number' ? Math.round(svc.price * 100) : null,
          },
        },
        { status: 400 }
      );
    }

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
      amount: unitAmount / 100,
    });
  } catch (error: any) {
    console.error('[Payments] create-intent error', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent', details: error?.message },
      { status: 500 }
    );
  }
}

