import { stripe } from '@/lib/stripeClient';
import { confirmBooking } from '@/lib/hapioClient';
import { getSqlClient } from '@/app/_utils/db';
import { upsertBrevoContact, sendBrevoEmail, syncCustomerToBrevo } from '@/lib/brevoClient';
import { generateBookingConfirmationEmail, generateCalendarLinks } from '@/lib/emails/bookingConfirmation';

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
    (pim.customer?.email as string | undefined) ||
    (pi as any).receipt_email ||
    (pi as any)?.latest_charge?.billing_details?.email ||
    null;
  const fullNameFromPi =
    (pim.customer?.name as string | undefined) ||
    ((pi as any)?.latest_charge?.billing_details?.name as string | undefined) ||
    null;
  const phoneFromPi =
    (pim.customer?.phone as string | undefined) ||
    ((pi as any)?.latest_charge?.billing_details?.phone as string | undefined) ||
    null;

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
        ${status === 'succeeded' ? 'succeeded' : status},
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
        metadata = COALESCE(bookings.metadata, '{}'::jsonb) || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id
    `) as any[];
    const ensuredBookingRowId = upsertRows?.[0]?.id || null;
    if (!ensuredBookingRowId) {
      throw new Error('Failed to ensure booking row');
    }

    // Upsert customer if email
    let customerId: string | null = null;
    let stripeCustomerId: string | null = null;
    if (emailFromPi) {
      const [firstName, ...lastParts] = (fullNameFromPi || '').split(' ').filter(Boolean);
      const lastName = lastParts.join(' ') || null;
      // Extract Stripe customer ID from payment intent if available
      stripeCustomerId = (pi as any).customer || null;
      
      const custRows = (await sql`
        INSERT INTO customers (email, first_name, last_name, phone, marketing_opt_in, stripe_customer_id, last_seen_at)
        VALUES (${emailFromPi}, ${firstName || null}, ${lastName}, ${phoneFromPi || null}, true, ${stripeCustomerId}, NOW())
        ON CONFLICT (email) DO UPDATE SET
          first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
          last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
          phone = COALESCE(EXCLUDED.phone, customers.phone),
          stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, customers.stripe_customer_id),
          last_seen_at = NOW()
        RETURNING id
      `) as any[];
      customerId = custRows?.[0]?.id || null;
      const displayName =
        firstName || lastName
          ? [firstName, lastName].filter(Boolean).join(' ')
          : fullNameFromPi || null;
      await sql`
        UPDATE bookings
        SET 
          customer_id = ${customerId},
          client_email = COALESCE(client_email, ${emailFromPi}),
          client_name = COALESCE(client_name, ${displayName}),
          client_phone = COALESCE(client_phone, ${phoneFromPi || null})
        WHERE id = ${ensuredBookingRowId}
      `;
    }

    // Insert payment with idempotency check (prevent duplicates if called twice)
    // Check if payment already exists for this booking and payment intent
    const existingPaymentResult = await sql`
      SELECT id FROM payments 
      WHERE booking_id = ${ensuredBookingRowId} 
        AND stripe_pi_id = ${(pi as any).id}
      LIMIT 1
    `;
    
    const existingPayments = Array.isArray(existingPaymentResult) 
      ? existingPaymentResult 
      : (existingPaymentResult as any)?.rows || [];
    
    let paymentId: string | null = null;
    if (existingPayments.length > 0 && existingPayments[0]?.id) {
      // Payment already exists, use existing ID
      paymentId = existingPayments[0].id;
    } else {
      // Insert new payment
      const paymentRows = (await sql`
        INSERT INTO payments (booking_id, stripe_pi_id, stripe_charge_id, amount_cents, currency, status)
        VALUES (
          ${ensuredBookingRowId},
          ${(pi as any).id},
          ${typeof (pi as any).latest_charge === 'string' ? (pi as any).latest_charge : null},
          ${amount_cents},
          ${currency},
          ${status === 'succeeded' ? 'succeeded' : status}
        )
        RETURNING id
      `) as any[];
      paymentId = paymentRows?.[0]?.id || null;
    }

    await sql`
      INSERT INTO booking_events (booking_id, type, data)
      VALUES (${ensuredBookingRowId}, ${'finalized'}, ${JSON.stringify({ stripe_pi_id: (pi as any).id, amount_cents, currency, traceId })}::jsonb)
    `;

    // Confirm on Hapio
    await confirmBooking(args.hapioBookingId, { isTemporary: false, metadata: { stripePaymentIntentId: (pi as any).id } });

    // Brevo (best-effort, outside of transaction scope but after we COMMIT)
    await sql`COMMIT`;

    // Sync customer to Brevo using database data (ensures we sync latest data, not just payment intent metadata)
    if (customerId) {
      try {
        await syncCustomerToBrevo({
          customerId,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
          tags: ['booked', svcId || 'service'],
        });
      } catch (e) {
        // Brevo sync failure is non-critical - booking is already finalized
        console.error('[finalizeCore] Brevo sync failed:', e);
      }
    }

    // Send confirmation email
    if (emailFromPi && customerId) {
      try {

        // Fetch service data for email (image, proper name, duration)
        let serviceImageUrl: string | null = null;
        let serviceDisplayName: string = svcName;
        let serviceDuration: string | null = null;
        
        if (svcId) {
          try {
            const serviceResult = await sql`
              SELECT name, image_url, duration_display 
              FROM services 
              WHERE id = ${svcId} OR slug = ${svcId}
              LIMIT 1
            `;
            const serviceRows = Array.isArray(serviceResult) 
              ? serviceResult 
              : (serviceResult as any)?.rows || [];
            if (serviceRows.length > 0) {
              serviceDisplayName = serviceRows[0].name || svcName;
              serviceImageUrl = serviceRows[0].image_url || null;
              serviceDuration = serviceRows[0].duration_display || null;
            }
          } catch (e) {
            // Service fetch failure is non-critical
          }
        }

        // Format booking date and time
        const bookingDate = slotStart ? new Date(slotStart) : new Date();
        const bookingTime = bookingDate.toLocaleTimeString('en-US', {
          timeZone: timezone || 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        // Generate calendar links
        const endDate = new Date(bookingDate);
        // Use service duration if available, otherwise default to 1 hour
        const durationHours = serviceDuration 
          ? parseInt(serviceDuration.match(/\d+/)?.[0] || '1') / 60 
          : 1;
        endDate.setHours(endDate.getHours() + durationHours);
        const calendarLinks = generateCalendarLinks(serviceDisplayName, bookingDate, endDate);

        // Generate beautiful email HTML
        const emailHtml = generateBookingConfirmationEmail({
          serviceName: serviceDisplayName,
          serviceImageUrl,
          clientName: fullNameFromPi,
          bookingDate,
          bookingTime,
          calendarLinks,
        });

        // Get receipt PDF attachment if payment intent exists
        const attachments: Array<{ name: string; content: string }> = [];
        if (args.paymentIntentId) {
          try {
            const { getStripeReceiptPdf } = await import('@/lib/stripeClient');
            const receiptPdf = await getStripeReceiptPdf(args.paymentIntentId);
            if (receiptPdf) {
              attachments.push({
                name: receiptPdf.filename,
                content: receiptPdf.content,
              });
            }
          } catch (e) {
            // Receipt fetch failure is non-critical
            console.error('[finalizeCore] Failed to fetch receipt PDF:', e);
          }
        }

        await sendBrevoEmail({
          to: [{ email: emailFromPi, name: fullNameFromPi || undefined }],
          subject: `Your ${serviceDisplayName} appointment is confirmed`,
          htmlContent: emailHtml,
          tags: ['booking_confirmed'],
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      } catch (e) {
        // Brevo failures are non-critical - booking is already finalized
        console.error('[finalizeCore] Email send failed:', e);
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
    throw e;
  }
}


