import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripeClient';
import { confirmBooking } from '@/lib/hapioClient';
import { getSqlClient } from '@/app/_utils/db';
import { upsertBrevoContact, sendBrevoEmail } from '@/lib/brevoClient';

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, bookingId } = (await request.json()) as {
      paymentIntentId: string;
      bookingId: string;
    };
    if (!paymentIntentId || !bookingId) {
      return NextResponse.json({ error: 'Missing paymentIntentId or bookingId' }, { status: 400 });
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const status = pi.status;
    if (!['succeeded', 'processing', 'requires_capture'].includes(status)) {
      return NextResponse.json(
        { error: `PaymentIntent not chargeable for booking. Status: ${status}` },
        { status: 400 }
      );
    }

    const sql = getSqlClient();
    const bookingRows = (await sql`
      SELECT id, hapio_booking_id, service_id, service_name, client_email, client_name, client_phone, metadata
      FROM bookings
      WHERE hapio_booking_id = ${bookingId}
      LIMIT 1
    `) as any[];
    const bookingRow = bookingRows?.[0] || null;
    const meta = bookingRow?.metadata || {};
    const cust = meta?.customer || {};
    const email = (cust?.email || bookingRow?.client_email || '').trim();
    const fullName = (cust?.name || bookingRow?.client_name || '').trim();
    const phone = (cust?.phone || bookingRow?.client_phone || '').trim();
    const [first_name, ...lastParts] = fullName.split(' ').filter(Boolean);
    const last_name = lastParts.join(' ');

    // If we couldn't find a booking row (lock may have failed), create a minimal record from PI metadata
    let ensuredBookingId: string | null = bookingRow?.id || null;
    if (!bookingRow) {
      const pim = (pi as any).metadata || {};
      const svcId = pim.service_id || pim.service_slug || null;
      const svcName = pim.service_slug || 'Service';
      const slotStart = pim.slot_start || null;
      const timezone = pim.timezone || null;
      const minimalMeta = {
        ...pim,
        stripePaymentIntentId: (pi as any).id,
        ensuredBy: 'finalize_fallback',
      };
      const inserted = (await sql`
        INSERT INTO bookings (
          hapio_booking_id, service_id, service_name, client_email, booking_date, payment_status, metadata
        ) VALUES (
          ${bookingId},
          ${svcId},
          ${svcName},
          ${email || (pi as any).receipt_email || null},
          ${slotStart ? slotStart : null},
          ${status},
          ${JSON.stringify(minimalMeta)}::jsonb
        )
        ON CONFLICT (hapio_booking_id) DO UPDATE SET
          metadata = jsonb_set(COALESCE(bookings.metadata, '{}'::jsonb), '{stripePaymentIntentId}', ${JSON.stringify((pi as any).id)}::jsonb, true),
          updated_at = NOW()
        RETURNING id
      `) as any[];
      ensuredBookingId = inserted?.[0]?.id || null;
    }

    // Upsert customer by email
    let customerId: string | null = null;
    if (email) {
      const upsert = (await sql`
        INSERT INTO customers (email, first_name, last_name, phone, last_seen_at)
        VALUES (${email}, ${first_name || null}, ${last_name || null}, ${phone || null}, NOW())
        ON CONFLICT (email) DO UPDATE SET
          first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
          last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
          phone = COALESCE(EXCLUDED.phone, customers.phone),
          last_seen_at = NOW()
        RETURNING id
      `) as any[];
      customerId = upsert?.[0]?.id || null;
      if (ensuredBookingId && customerId) {
        await sql`UPDATE bookings SET customer_id = ${customerId} WHERE id = ${ensuredBookingId}`;
      }
    }

    const amount_cents = typeof (pi as any).amount === 'number' ? (pi as any).amount : 0;
    const currency = (pi as any).currency || 'usd';

    // Save payment row and event
    if (ensuredBookingId) {
      await sql`
        INSERT INTO payments (booking_id, stripe_pi_id, stripe_charge_id, amount_cents, currency, status)
        VALUES (
          ${ensuredBookingId},
          ${pi.id},
          ${typeof (pi as any).latest_charge === 'string' ? (pi as any).latest_charge : null},
          ${amount_cents},
          ${currency},
          ${status}
        )
      `;
      await sql`
        INSERT INTO booking_events (booking_id, type, data)
        VALUES (${ensuredBookingId}, ${'finalized'}, ${JSON.stringify({ stripe_pi_id: pi.id, amount_cents, currency })}::jsonb)
      `;
    }

    // Finalize booking on Hapio
    const booking = await confirmBooking(bookingId, { isTemporary: false, metadata: { stripePaymentIntentId: (pi as any).id } });

    // Upsert Brevo contact (no notes)
    if (email) {
      try {
        const listEnv = process.env.BREVO_LIST_ID;
        const listId = listEnv ? Number(listEnv) : undefined;
        await upsertBrevoContact({
          email,
          firstName: first_name || undefined,
          lastName: last_name || undefined,
          phone: phone || undefined,
          listId: listId && Number.isFinite(listId) ? listId : undefined,
          tags: ['booked', bookingRow?.service_id || 'service'],
        });
        if (ensuredBookingId) {
          await sql`
            INSERT INTO booking_events (booking_id, type, data)
            VALUES (${ensuredBookingId}, ${'email_sent'}, ${JSON.stringify({ kind: 'brevo_upsert' })}::jsonb)
          `;
        }
      } catch (e) {
        console.error('[Brevo] upsert failed', e);
      }
    }

    // Send confirmation email (best-effort)
    if (email) {
      try {
        const dateStr = (booking as any).startsAt;
        const svc = bookingRow?.service_name || 'Service';
        await sendBrevoEmail({
          to: [{ email, name: fullName }],
          subject: `Your appointment is confirmed`,
          htmlContent: `<p>Thanks for booking <strong>${svc}</strong>.</p><p>Date/Time: ${dateStr}</p>`,
          tags: ['booking_confirmed'],
        });
        if (ensuredBookingId) {
          await sql`
            INSERT INTO booking_events (booking_id, type, data)
            VALUES (${ensuredBookingId}, ${'email_sent'}, ${JSON.stringify({ kind: 'booking_confirmed' })}::jsonb)
          `;
        }
      } catch (e) {
        console.error('[Brevo] email send failed', e);
      }
    }

    return NextResponse.json({ booking });
  } catch (error: any) {
    console.error('[Bookings] finalize error', error);
    return NextResponse.json(
      { error: 'Failed to finalize booking', details: error?.message },
      { status: 500 }
    );
  }
}


