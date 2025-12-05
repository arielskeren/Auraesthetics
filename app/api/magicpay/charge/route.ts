import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { charge } from '@/lib/magicpayClient';
import { getHapioServiceConfig } from '@/lib/hapioServiceCatalog';
import { confirmBooking } from '@/lib/hapioClient';
import { upsertBrevoContact, sendBrevoEmail, syncCustomerToBrevo } from '@/lib/brevoClient';
import { generateBookingConfirmationEmail, generateCalendarLinks } from '@/lib/emails';
import { ensureOutlookEventForBooking } from '@/lib/outlookBookingSync';
import { EST_TIMEZONE } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

interface ChargeRequestBody {
  /** Payment token from Collect.js tokenization */
  paymentToken: string;
  /** Service slug or ID */
  serviceSlug?: string;
  serviceId?: string;
  /** Booking slot times */
  slotStart: string;
  slotEnd: string;
  timezone?: string | null;
  /** Hapio booking ID (from lock step) */
  bookingId: string;
  /** Amount in cents (optional - uses service price if not provided) */
  amountCents?: number | null;
  /** Discount code if applied */
  discountCode?: string | null;
  /** Customer details */
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    notes?: string;
  };
  /** Payment type: full or deposit */
  paymentType?: 'full' | 'deposit';
}

export async function POST(request: NextRequest) {
  const traceId = Math.random().toString(36).slice(2);
  
  try {
    const body = (await request.json()) as ChargeRequestBody;
    const {
      paymentToken,
      serviceSlug,
      serviceId,
      slotStart,
      slotEnd,
      timezone,
      bookingId,
      amountCents,
      discountCode,
      customer,
      paymentType = 'full',
    } = body;

    // Validate required fields
    if (!paymentToken) {
      return NextResponse.json(
        { error: 'Payment token is required' },
        { status: 400 }
      );
    }

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    if (!customer?.email || !customer?.firstName || !customer?.lastName) {
      return NextResponse.json(
        { error: 'Customer details (firstName, lastName, email) are required' },
        { status: 400 }
      );
    }

    if ((!serviceId && !serviceSlug) || !slotStart || !slotEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceId|serviceSlug, slotStart, slotEnd' },
        { status: 400 }
      );
    }

    // Validate date formats
    const startDate = new Date(slotStart);
    const endDate = new Date(slotEnd);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for slotStart or slotEnd' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    // Get service details from database
    let svc: {
      id: string;
      slug: string;
      name: string;
      price: number | null;
      hapio_service_id: string | null;
    } | null = null;

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

    // Check for existing Customer Vault ID
    let existingVaultId: string | null = null;
    const customerCheck = await sql`
      SELECT magicpay_customer_vault_id 
      FROM customers 
      WHERE LOWER(email) = LOWER(${customer.email})
      LIMIT 1
    `;
    const customerRows = Array.isArray(customerCheck) 
      ? customerCheck 
      : (customerCheck as any)?.rows || [];
    if (customerRows.length > 0 && customerRows[0]?.magicpay_customer_vault_id) {
      existingVaultId = customerRows[0].magicpay_customer_vault_id;
    }

    // Calculate amount
    let amountDollars = 0;
    if (typeof amountCents === 'number' && Number.isFinite(amountCents) && amountCents > 0) {
      amountDollars = amountCents / 100;
    } else if (typeof svc.price === 'number' && Number.isFinite(svc.price)) {
      amountDollars = svc.price;
    }

    // Minimum charge check (MagicPay may have minimums similar to Stripe)
    const MIN_AMOUNT = 0.50;
    if (amountDollars < MIN_AMOUNT) {
      return NextResponse.json(
        {
          error: `Amount must be at least $${MIN_AMOUNT.toFixed(2)}`,
          details: { providedAmountCents: amountCents, dbPrice: svc.price },
        },
        { status: 400 }
      );
    }

    // Check for duplicate payment (idempotency)
    const existingPayment = await sql`
      SELECT id, magicpay_transaction_id, payment_status 
      FROM bookings 
      WHERE hapio_booking_id = ${bookingId}
        AND payment_status IN ('succeeded', 'paid', 'processing')
        AND magicpay_transaction_id IS NOT NULL
      LIMIT 1
    `;
    const existingPaymentRows = Array.isArray(existingPayment) 
      ? existingPayment 
      : (existingPayment as any)?.rows || [];
    
    if (existingPaymentRows.length > 0) {
      // Already paid - return success without double-charging
      console.log('[MagicPay Charge] Duplicate request detected, returning existing payment', {
        bookingId,
        existingTransactionId: existingPaymentRows[0].magicpay_transaction_id,
      });
      return NextResponse.json({
        success: true,
        transactionId: existingPaymentRows[0].magicpay_transaction_id,
        bookingId,
        amount: amountDollars,
        duplicate: true,
        message: 'Payment already processed for this booking',
      });
    }

    // Get client IP for fraud prevention
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown';

    // Resolve hapio service id for metadata
    let hapioServiceId = svc.hapio_service_id;
    if (!hapioServiceId) {
      const cfg = getHapioServiceConfig(svc.slug);
      hapioServiceId = cfg?.serviceId ?? null;
    }

    // Process payment via MagicPay
    const chargeResult = await charge({
      paymentToken,
      amount: amountDollars,
      currency: 'USD',
      orderId: bookingId,
      orderDescription: `${svc.name} - ${paymentType === 'deposit' ? '50% Deposit' : 'Full Payment'}`,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
      },
      ipAddress: clientIp,
      saveToVault: true,
      customerVaultId: existingVaultId || undefined,
    });

    if (!chargeResult.success) {
      console.error('[MagicPay Charge] Payment failed', {
        bookingId,
        responseCode: chargeResult.responseCode,
        responseText: chargeResult.responseText,
        traceId,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: chargeResult.responseText || 'Payment failed',
          code: chargeResult.responseCode,
        },
        { status: 400 }
      );
    }

    // Payment successful - start transaction
    await sql`BEGIN`;
    
    try {
      const discountCodeUpper = discountCode ? discountCode.toUpperCase() : null;
      const usedWelcomeOffer = discountCodeUpper === 'WELCOME15';

      // Build metadata for booking
      const bookingMetadata = {
        magicpay_transaction_id: chargeResult.transactionId,
        magicpay_auth_code: chargeResult.authCode,
        payment_type: paymentType,
        amount_charged: amountDollars,
        discountCode: discountCodeUpper,
        traceId,
        customer: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          notes: customer.notes,
        },
        slot_start: slotStart,
        slot_end: slotEnd,
        timezone: timezone,
        hapio_service_id: hapioServiceId,
      };

      // Upsert booking record
      const upsertBookingRows = (await sql`
        INSERT INTO bookings (
          hapio_booking_id, service_id, service_name, client_email, client_name, client_phone,
          booking_date, payment_status, magicpay_transaction_id, magicpay_auth_code, metadata, updated_at
        ) VALUES (
          ${bookingId},
          ${svc.id},
          ${svc.name},
          ${customer.email},
          ${`${customer.firstName} ${customer.lastName}`.trim()},
          ${customer.phone || null},
          ${slotStart},
          'succeeded',
          ${chargeResult.transactionId},
          ${chargeResult.authCode},
          ${JSON.stringify(bookingMetadata)}::jsonb,
          NOW()
        )
        ON CONFLICT (hapio_booking_id) DO UPDATE SET
          client_email = COALESCE(EXCLUDED.client_email, bookings.client_email),
          client_name = COALESCE(EXCLUDED.client_name, bookings.client_name),
          client_phone = COALESCE(EXCLUDED.client_phone, bookings.client_phone),
          service_id = COALESCE(EXCLUDED.service_id, bookings.service_id),
          service_name = COALESCE(EXCLUDED.service_name, bookings.service_name),
          booking_date = COALESCE(EXCLUDED.booking_date, bookings.booking_date),
          payment_status = EXCLUDED.payment_status,
          magicpay_transaction_id = EXCLUDED.magicpay_transaction_id,
          magicpay_auth_code = EXCLUDED.magicpay_auth_code,
          metadata = COALESCE(bookings.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id
      `) as any[];
      
      const ensuredBookingRowId = upsertBookingRows?.[0]?.id || null;
      if (!ensuredBookingRowId) {
        throw new Error('Failed to create/update booking record');
      }

      // Upsert customer
      let customerId: string | null = null;
      const custRows = (await sql`
        INSERT INTO customers (
          email, first_name, last_name, phone, marketing_opt_in, 
          magicpay_customer_vault_id, last_seen_at, used_welcome_offer
        )
        VALUES (
          ${customer.email}, 
          ${customer.firstName}, 
          ${customer.lastName}, 
          ${customer.phone || null}, 
          true,
          ${chargeResult.customerVaultId || existingVaultId},
          NOW(),
          ${usedWelcomeOffer}
        )
        ON CONFLICT (email) DO UPDATE SET
          first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
          last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
          phone = COALESCE(EXCLUDED.phone, customers.phone),
          magicpay_customer_vault_id = COALESCE(EXCLUDED.magicpay_customer_vault_id, customers.magicpay_customer_vault_id),
          last_seen_at = NOW(),
          used_welcome_offer = COALESCE(customers.used_welcome_offer, false) OR ${usedWelcomeOffer}
        RETURNING id
      `) as any[];
      customerId = custRows?.[0]?.id || null;

      // Link customer to booking
      if (customerId) {
        await sql`
          UPDATE bookings SET customer_id = ${customerId} WHERE id = ${ensuredBookingRowId}
        `;
      }

      // Insert payment record
      const paymentRows = (await sql`
        INSERT INTO payments (
          booking_id, magicpay_transaction_id, magicpay_auth_code, 
          amount_cents, currency, status, payment_provider
        )
        VALUES (
          ${ensuredBookingRowId},
          ${chargeResult.transactionId},
          ${chargeResult.authCode},
          ${Math.round(amountDollars * 100)},
          'usd',
          'succeeded',
          'magicpay'
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `) as any[];

      // Insert booking event
      await sql`
        INSERT INTO booking_events (booking_id, type, data)
        VALUES (
          ${ensuredBookingRowId}, 
          'finalized', 
          ${JSON.stringify({
            magicpay_transaction_id: chargeResult.transactionId,
            magicpay_auth_code: chargeResult.authCode,
            amount_cents: Math.round(amountDollars * 100),
            currency: 'usd',
            traceId,
            discountCode: discountCodeUpper,
            paymentType,
          })}::jsonb
        )
      `;

      // Handle discount code usage tracking
      if (discountCodeUpper) {
        try {
          // Check for one-time discount code
          const oneTimeCodeResult = await sql`
            SELECT id, customer_id FROM discount_codes 
            WHERE code = ${discountCodeUpper} 
              AND code_type = 'one_time'
              AND used = false
              AND is_active = true
              AND (expires_at IS NULL OR expires_at > NOW())
            LIMIT 1
            FOR UPDATE
          `;
          const oneTimeRows = Array.isArray(oneTimeCodeResult) 
            ? oneTimeCodeResult 
            : (oneTimeCodeResult as any)?.rows || [];
          
          if (oneTimeRows.length > 0) {
            // Mark one-time code as used
            await sql`
              UPDATE discount_codes 
              SET used = true, used_at = NOW(), updated_at = NOW()
              WHERE id = ${oneTimeRows[0].id} AND used = false
            `;
          } else {
            // Check for global discount code usage tracking
            const globalCodeResult = await sql`
              SELECT id, max_uses, usage_count
              FROM discount_codes 
              WHERE code = ${discountCodeUpper}
                AND code_type = 'global'
                AND is_active = true
              LIMIT 1
              FOR UPDATE
            `;
            const globalCodeRows = Array.isArray(globalCodeResult) 
              ? globalCodeResult 
              : (globalCodeResult as any)?.rows || [];
            
            if (globalCodeRows.length > 0) {
              const codeRecord = globalCodeRows[0];
              const newUsage = (codeRecord.usage_count || 0) + 1;
              const shouldDeactivate = codeRecord.max_uses && newUsage >= codeRecord.max_uses;
              
              await sql`
                UPDATE discount_codes 
                SET 
                  usage_count = ${newUsage},
                  is_active = ${!shouldDeactivate},
                  updated_at = NOW()
                WHERE id = ${codeRecord.id}
              `;
            }
          }
        } catch (e) {
          console.error('[MagicPay Charge] Failed to track discount code usage:', e);
          // Non-critical - continue
        }
      }

      // Confirm booking in Hapio
      try {
        await confirmBooking(bookingId, { 
          isTemporary: false, 
          metadata: { 
            magicpay_transaction_id: chargeResult.transactionId,
            traceId,
          } 
        });
      } catch (hapioError: any) {
        console.error('[MagicPay Charge] Hapio confirmation failed:', hapioError?.message);
        // Rollback the transaction since we can't confirm the booking
        await sql`ROLLBACK`;
        
        // Attempt to refund the payment
        try {
          const { refund } = await import('@/lib/magicpayClient');
          await refund({
            transactionId: chargeResult.transactionId!,
            orderId: bookingId,
          });
        } catch (refundError) {
          console.error('[MagicPay Charge] Refund after Hapio failure also failed:', refundError);
        }
        
        return NextResponse.json(
          { error: 'Failed to confirm booking. Payment has been refunded.' },
          { status: 500 }
        );
      }

      // Commit transaction
      await sql`COMMIT`;

      // Post-commit: Outlook sync (non-blocking)
      if (process.env.OUTLOOK_SYNC_ENABLED !== 'false') {
        try {
          const outlookResult = await ensureOutlookEventForBooking(ensuredBookingRowId);
          if (outlookResult.eventId) {
            await sql`
              UPDATE bookings 
              SET outlook_event_id = ${outlookResult.eventId}, 
                  outlook_sync_status = ${outlookResult.action === 'created' ? 'synced' : 'updated'}
              WHERE id = ${ensuredBookingRowId}
            `;
          }
        } catch (outlookError) {
          console.error('[MagicPay Charge] Outlook sync failed:', outlookError);
          await sql`
            UPDATE bookings SET outlook_sync_status = 'failed' WHERE id = ${ensuredBookingRowId}
          `;
        }
      }

      // Post-commit: Brevo sync (non-blocking)
      if (customerId) {
        try {
          await syncCustomerToBrevo({
            customerId,
            sql,
            listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
            tags: ['booked', svc.slug || 'service'],
          });
        } catch (e) {
          console.error('[MagicPay Charge] Brevo sync failed:', e);
        }
      }

      // Post-commit: Send confirmation email (non-blocking)
      try {
        const bookingDate = new Date(slotStart);
        const bookingTime = bookingDate.toLocaleTimeString('en-US', {
          timeZone: EST_TIMEZONE,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        // Get service image for email
        let serviceImageUrl: string | null = null;
        let serviceDuration: string | null = null;
        try {
          const serviceResult = await sql`
            SELECT image_url, duration_display FROM services WHERE id = ${svc.id} LIMIT 1
          `;
          const serviceRows = Array.isArray(serviceResult) 
            ? serviceResult 
            : (serviceResult as any)?.rows || [];
          if (serviceRows.length > 0) {
            serviceImageUrl = serviceRows[0].image_url || null;
            serviceDuration = serviceRows[0].duration_display || null;
          }
        } catch (e) {
          // Non-critical
        }

        const endBookingDate = new Date(bookingDate);
        const durationHours = serviceDuration 
          ? parseInt(serviceDuration.match(/\d+/)?.[0] || '1') / 60 
          : 1;
        endBookingDate.setHours(endBookingDate.getHours() + durationHours);

        const calendarLinks = generateCalendarLinks(svc.name, bookingDate, endBookingDate);

        const emailHtml = generateBookingConfirmationEmail({
          serviceName: svc.name,
          serviceImageUrl,
          clientName: `${customer.firstName} ${customer.lastName}`.trim(),
          bookingDate,
          bookingTime,
          bookingId: ensuredBookingRowId || bookingId,
          calendarLinks,
        });

        await sendBrevoEmail({
          to: [{ email: customer.email, name: `${customer.firstName} ${customer.lastName}`.trim() }],
          subject: `Your ${svc.name} appointment is confirmed`,
          htmlContent: emailHtml,
          tags: ['booking_confirmed'],
        });
      } catch (e) {
        console.error('[MagicPay Charge] Email send failed:', e);
      }

      // Return success response
      return NextResponse.json({
        success: true,
        transactionId: chargeResult.transactionId,
        authCode: chargeResult.authCode,
        bookingId,
        internalBookingId: ensuredBookingRowId,
        customerId,
        customerVaultId: chargeResult.customerVaultId,
        amount: amountDollars,
        paymentType,
      });

    } catch (txError) {
      try {
        await sql`ROLLBACK`;
      } catch {}
      throw txError;
    }

  } catch (error: any) {
    console.error('[MagicPay Charge] Error:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to process payment', details: error?.message },
      { status: 500 }
    );
  }
}

