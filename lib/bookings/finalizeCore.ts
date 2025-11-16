import { stripe } from '@/lib/stripeClient';
import { confirmBooking } from '@/lib/hapioClient';
import { getSqlClient } from '@/app/_utils/db';
import { upsertBrevoContact, sendBrevoEmail } from '@/lib/brevoClient';

export type FinalizeResult = {
  bookingId: string;
  ensuredBookingRowId: string | null;
  customerId: string | null;
  paymentId: string | null;
};

export async function finalizeBookingTransactional(args: {
  paymentIntentId: string;
  hapioBookingId: string;
  debug?: boolean;
}): Promise<FinalizeResult & { debug?: any }> {
  const sql = getSqlClient();
  const traceId = Math.random().toString(36).slice(2);

  const pi = await stripe.paymentIntents.retrieve(args.paymentIntentId, {
    expand: ['latest_charge.billing_details'],
  } as any);
  const status = (pi as any).status;
  if (!['succeeded', 'processing', 'requires_capture'].includes(status)) {
    throw new Error(`PI not chargeable: ${status}`);
  }

  const pim = (pi as any).metadata || {};
  const svcId = pim.service_id || pim.service_slug || null;
  const svcName = pim.service_slug || 'Service';
  const slotStart = pim.slot_start || null;
  const timezone = pim.timezone || null;
  const emailFromPi =
    (pi as any).receipt_email ||
    (pi as any)?.latest_charge?.billing_details?.email ||
    null;
  const fullNameFromPi = (pi as any)?.latest_charge?.billing_details?.name || null;

  const amount_cents = typeof (pi as any).amount === 'number' ? (pi as any).amount : 0;
  const currency = (pi as any).currency || 'usd';

  await sql`BEGIN`;
  try {
    // Upsert booking by hapio id
    const minimalMeta = {
      ...pim,
      stripePaymentIntentId: (pi as any).id,
      ensuredBy: 'finalize_txn',
      traceId,
    };
    const upsertRows = (await sql`
      INSERT INTO bookings (
        hapio_booking_id, service_id, service_name, client_email, booking_date, payment_status, payment_intent_id, metadata, updated_at
      ) VALUES (
        ${args.hapioBookingId},
        ${svcId},
        ${svcName},
        ${emailFromPi},
        ${slotStart ? slotStart : null},
        ${status},
        ${(pi as any).id},
        ${JSON.stringify(minimalMeta)}::jsonb,
        NOW()
      )
      ON CONFLICT (hapio_booking_id) DO UPDATE SET
        client_email = COALESCE(EXCLUDED.client_email, bookings.client_email),
        service_id = COALESCE(EXCLUDED.service_id, bookings.service_id),
        service_name = COALESCE(EXCLUDED.service_name, bookings.service_name),
        booking_date = COALESCE(EXCLUDED.booking_date, bookings.booking_date),
        payment_status = EXCLUDED.payment_status,
        payment_intent_id = EXCLUDED.payment_intent_id,
        metadata = bookings.metadata || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id
    `) as any[];
    const ensuredBookingRowId = upsertRows?.[0]?.id || null;
    if (!ensuredBookingRowId) {
      throw new Error('Failed to ensure booking row');
    }

    // Upsert customer if email
    let customerId: string | null = null;
    if (emailFromPi) {
      const [firstName, ...lastParts] = (fullNameFromPi || '').split(' ').filter(Boolean);
      const lastName = lastParts.join(' ') || null;
      const custRows = (await sql`
        INSERT INTO customers (email, first_name, last_name, last_seen_at)
        VALUES (${emailFromPi}, ${firstName || null}, ${lastName}, NOW())
        ON CONFLICT (email) DO UPDATE SET
          first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
          last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
          last_seen_at = NOW()
        RETURNING id
      `) as any[];
      customerId = custRows?.[0]?.id || null;
      await sql`UPDATE bookings SET customer_id = ${customerId} WHERE id = ${ensuredBookingRowId}`;
    }

    // Insert payment
    const paymentRows = (await sql`
      INSERT INTO payments (booking_id, stripe_pi_id, stripe_charge_id, amount_cents, currency, status)
      VALUES (
        ${ensuredBookingRowId},
        ${(pi as any).id},
        ${typeof (pi as any).latest_charge === 'string' ? (pi as any).latest_charge : null},
        ${amount_cents},
        ${currency},
        ${status}
      )
      RETURNING id
    `) as any[];
    const paymentId = paymentRows?.[0]?.id || null;

    await sql`
      INSERT INTO booking_events (booking_id, type, data)
      VALUES (${ensuredBookingRowId}, ${'finalized'}, ${JSON.stringify({ stripe_pi_id: (pi as any).id, amount_cents, currency, traceId })}::jsonb)
    `;

    // Confirm on Hapio
    await confirmBooking(args.hapioBookingId, { isTemporary: false, metadata: { stripePaymentIntentId: (pi as any).id } });

    // Brevo (best-effort, outside of transaction scope but after we COMMIT)
    await sql`COMMIT`;

    if (emailFromPi) {
      try {
        const listEnv = process.env.BREVO_LIST_ID;
        const listId = listEnv ? Number(listEnv) : undefined;
        await upsertBrevoContact({
          email: emailFromPi,
          firstName: fullNameFromPi?.split(' ')?.[0],
          lastName: fullNameFromPi?.split(' ')?.slice(1)?.join(' '),
          listId: listId && Number.isFinite(listId) ? listId : undefined,
          tags: ['booked', svcId || 'service'],
        });
        await sendBrevoEmail({
          to: [{ email: emailFromPi, name: fullNameFromPi || undefined }],
          subject: 'Your appointment is confirmed',
          htmlContent: `<p>Thanks for booking <strong>${svcName}</strong>.</p><p>Date/Time: ${slotStart || ''} (${timezone || ''})</p>`,
          tags: ['booking_confirmed'],
        });
      } catch (e) {
        console.error('[Brevo] finalize email/upsert failed', e);
      }
    }

    return {
      bookingId: args.hapioBookingId,
      ensuredBookingRowId,
      customerId,
      paymentId,
      debug: args.debug
        ? { traceId, status, amount_cents, currency }
        : undefined,
    };
  } catch (e) {
    try {
      await sql`ROLLBACK`;
    } catch {}
    console.error('[Finalize][trace]', { error: (e as any)?.message, traceId });
    throw e;
  }
}


