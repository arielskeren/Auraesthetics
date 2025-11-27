import { stripe } from '@/lib/stripeClient';
import { confirmBooking } from '@/lib/hapioClient';
import { getSqlClient } from '@/app/_utils/db';
import { upsertBrevoContact, sendBrevoEmail, syncCustomerToBrevo } from '@/lib/brevoClient';
import { generateBookingConfirmationEmail, generateCalendarLinks } from '@/lib/emails';
import { ensureOutlookEventForBooking } from '@/lib/outlookBookingSync';

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
    // Extract discount code from payment intent metadata
    const discountCodeFromMetadata = pim.discountCode || pim.discount_code || null;
    
    // Upsert booking by hapio id
    const minimalMeta = {
      ...pim,
      stripePaymentIntentId: (pi as any).id,
      ensuredBy: 'finalize_txn',
      traceId,
      discountCode: discountCodeFromMetadata ? (typeof discountCodeFromMetadata === 'string' ? discountCodeFromMetadata.toUpperCase() : discountCodeFromMetadata) : null,
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

    // Check if WELCOME15 discount code was used
    const usedWelcomeOffer = discountCodeFromMetadata && typeof discountCodeFromMetadata === 'string' && discountCodeFromMetadata.toUpperCase() === 'WELCOME15';
    
    // Mark one-time discount code as used if payment succeeds
    // CRITICAL: Must validate customer match to prevent code theft
    // CRITICAL: Use SELECT FOR UPDATE to prevent race conditions
    let oneTimeCodeId: string | null = null;
    if (discountCodeFromMetadata && typeof discountCodeFromMetadata === 'string') {
      try {
        const codeUpper = discountCodeFromMetadata.toUpperCase();
        // CRITICAL: Use SELECT FOR UPDATE to lock the row and prevent concurrent usage
        // First check if code exists and is valid (with row lock)
        const oneTimeCodeResult = await sql`
          SELECT id, customer_id FROM discount_codes 
          WHERE code = ${codeUpper} 
            AND code_type = 'one_time'
            AND used = false
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1
          FOR UPDATE
        `;
        const oneTimeRows = Array.isArray(oneTimeCodeResult) 
          ? oneTimeCodeResult 
          : (oneTimeCodeResult as any)?.rows || [];
        if (oneTimeRows.length > 0) {
          const codeRecord = oneTimeRows[0];
          // If code is customer-specific, verify customer matches
          if (codeRecord.customer_id) {
            if (!emailFromPi) {
              // No email in payment - log security issue but still mark as used to prevent reuse
              console.error('[finalizeCore] One-time code used without email (customer-specific code):', {
                code: codeUpper,
                codeCustomerId: codeRecord.customer_id,
              });
              // Still mark as used to prevent code reuse, but log security issue
              oneTimeCodeId = codeRecord.id;
            } else {
              const customerMatch = await sql`
                SELECT id FROM customers 
                WHERE id = ${codeRecord.customer_id} 
                  AND LOWER(email) = LOWER(${emailFromPi})
                LIMIT 1
              `;
              const customerRows = Array.isArray(customerMatch) 
                ? customerMatch 
                : (customerMatch as any)?.rows || [];
              if (customerRows.length === 0) {
                // Customer doesn't match - log security issue but still mark as used to prevent reuse
                console.error('[finalizeCore] One-time code customer mismatch (security issue):', {
                  code: codeUpper,
                  codeCustomerId: codeRecord.customer_id,
                  paymentEmail: emailFromPi,
                });
                // Still mark as used to prevent code reuse, but log security issue
                oneTimeCodeId = codeRecord.id;
              } else {
                // Customer matches - safe to mark as used
                oneTimeCodeId = codeRecord.id;
              }
            }
          } else {
            // Code is not customer-specific - safe to use
            oneTimeCodeId = codeRecord.id;
          }
        }
      } catch (e) {
        // Non-critical - continue
        console.error('[finalizeCore] Failed to check one-time code:', e);
      }
    }

    // Upsert customer if email
    let customerId: string | null = null;
    let stripeCustomerId: string | null = null;
    let displayName: string | null = null;
    if (emailFromPi) {
      const [firstName, ...lastParts] = (fullNameFromPi || '').split(' ').filter(Boolean);
      const lastName = lastParts.join(' ') || null;
      // Extract Stripe customer ID from payment intent if available
      stripeCustomerId = (pi as any).customer || null;
      
      displayName =
        firstName || lastName
          ? [firstName, lastName].filter(Boolean).join(' ')
          : fullNameFromPi || null;
      
      // Check if used_welcome_offer column exists
      let hasWelcomeOfferColumn = false;
      try {
        const columnCheck = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'customers' 
            AND column_name = 'used_welcome_offer'
          LIMIT 1
        `;
        hasWelcomeOfferColumn = Array.isArray(columnCheck) 
          ? columnCheck.length > 0 
          : ((columnCheck as any)?.rows || []).length > 0;
      } catch (e) {
        // If check fails, assume column doesn't exist
        hasWelcomeOfferColumn = false;
      }
      
      // Build INSERT/UPDATE query conditionally based on column existence
      const custRows = hasWelcomeOfferColumn
        ? (await sql`
            INSERT INTO customers (email, first_name, last_name, phone, marketing_opt_in, stripe_customer_id, last_seen_at, used_welcome_offer)
            VALUES (${emailFromPi}, ${firstName || null}, ${lastName}, ${phoneFromPi || null}, true, ${stripeCustomerId}, NOW(), ${usedWelcomeOffer || false})
            ON CONFLICT (email) DO UPDATE SET
              first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
              last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
              phone = COALESCE(EXCLUDED.phone, customers.phone),
              stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, customers.stripe_customer_id),
              last_seen_at = NOW(),
              used_welcome_offer = COALESCE(customers.used_welcome_offer, false) OR ${usedWelcomeOffer || false}
            RETURNING id
          `) as any[]
        : (await sql`
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
      VALUES (${ensuredBookingRowId}, ${'finalized'}, ${JSON.stringify({ 
        stripe_pi_id: (pi as any).id, 
        amount_cents, 
        currency, 
        traceId,
        discountCode: discountCodeFromMetadata ? (typeof discountCodeFromMetadata === 'string' ? discountCodeFromMetadata.toUpperCase() : discountCodeFromMetadata) : null
      })}::jsonb)
    `;

    // Mark one-time discount code as used (inside transaction to ensure atomicity)
    // CRITICAL: The row is already locked by SELECT FOR UPDATE, so this update is safe
    if (oneTimeCodeId) {
      try {
        const updateResult = await sql`
          UPDATE discount_codes 
          SET used = true, used_at = NOW(), updated_at = NOW()
          WHERE id = ${oneTimeCodeId} AND code_type = 'one_time' AND used = false
          RETURNING id, code, used, used_at
        `;
        const updatedRows = Array.isArray(updateResult) 
          ? updateResult 
          : (updateResult as any)?.rows || [];
        if (updatedRows.length === 0) {
          console.warn('[finalizeCore] Failed to mark one-time code as used - code may have already been used:', oneTimeCodeId);
        } else {
          console.log('[finalizeCore] Successfully marked one-time code as used:', {
            code: updatedRows[0].code,
            used: updatedRows[0].used,
            used_at: updatedRows[0].used_at,
          });
        }
        // Verify the update succeeded (row might have been updated by another transaction)
        const verifyResult = await sql`
          SELECT used FROM discount_codes WHERE id = ${oneTimeCodeId} AND code_type = 'one_time' LIMIT 1
        `;
        const verifyRows = Array.isArray(verifyResult) 
          ? verifyResult 
          : (verifyResult as any)?.rows || [];
        if (verifyRows.length > 0 && !verifyRows[0].used) {
          console.warn('[finalizeCore] One-time code was not marked as used - possible race condition');
        }
      } catch (e) {
        // Non-critical - log but continue
        console.error('[finalizeCore] Failed to mark one-time code as used:', e);
      }
    }

    // Track global discount code usage (inside transaction to ensure atomicity)
    // Only process if this is NOT a one-time code (one-time codes are handled above)
    if (discountCodeFromMetadata && typeof discountCodeFromMetadata === 'string' && !oneTimeCodeId) {
      try {
        const codeUpper = discountCodeFromMetadata.toUpperCase();
        
        // Use SELECT FOR UPDATE to lock the row and prevent concurrent usage
        const globalCodeResult = await sql`
          SELECT id, max_uses, usage_count, is_active
          FROM discount_codes 
          WHERE code = ${codeUpper}
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
          const currentUsage = codeRecord.usage_count || 0;
          const newUsage = currentUsage + 1;
          const maxUses = codeRecord.max_uses;
          
          // Determine if code should be deactivated (reached max uses)
          let newIsActive = codeRecord.is_active;
          if (maxUses !== null && maxUses !== undefined && newUsage >= maxUses) {
            newIsActive = false;
            console.log('[finalizeCore] Global code reached max_uses limit, deactivating:', {
              code: codeUpper,
              usage: newUsage,
              maxUses: maxUses,
            });
          }
          
          // Update usage count and active status atomically
          const updateResult = await sql`
            UPDATE discount_codes 
            SET 
              usage_count = ${newUsage},
              is_active = ${newIsActive},
              updated_at = NOW()
            WHERE id = ${codeRecord.id}
            RETURNING id, code, usage_count, is_active
          `;
          const updatedRows = Array.isArray(updateResult) 
            ? updateResult 
            : (updateResult as any)?.rows || [];
          
          if (updatedRows.length > 0) {
            console.log('[finalizeCore] Successfully updated global code usage:', {
              code: updatedRows[0].code,
              usage_count: updatedRows[0].usage_count,
              is_active: updatedRows[0].is_active,
            });
            
          } else {
            console.warn('[finalizeCore] Failed to update global code usage - row may have been updated by another transaction');
          }
        }
      } catch (e) {
        // Non-critical - log but continue
        console.error('[finalizeCore] Failed to track global code usage:', e);
      }
    }

    // Confirm on Hapio (critical - must succeed before committing transaction)
    try {
      await confirmBooking(args.hapioBookingId, { isTemporary: false, metadata: { stripePaymentIntentId: (pi as any).id } });
    } catch (hapioError: any) {
      // Hapio confirmation failure is critical - rollback transaction
      await sql`ROLLBACK`;
      throw new Error(`Failed to confirm booking in Hapio: ${hapioError?.message || hapioError}`);
    }

    // Brevo (best-effort, outside of transaction scope but after we COMMIT)
    await sql`COMMIT`;

    // Sync to Outlook Calendar (best-effort, after commit)
    // The function will fetch all booking data including payment, discount, etc.
    let outlookEventId: string | null = null;
    if (process.env.OUTLOOK_SYNC_ENABLED !== 'false') {
      try {
        // Pass just the booking ID - function will fetch all necessary data
        const outlookResult = await ensureOutlookEventForBooking(ensuredBookingRowId);
        outlookEventId = outlookResult.eventId;
        
        // Update booking with Outlook event ID
        if (outlookEventId) {
          await sql`
            UPDATE bookings 
            SET outlook_event_id = ${outlookEventId}, outlook_sync_status = ${outlookResult.action === 'created' ? 'synced' : 'updated'}
            WHERE id = ${ensuredBookingRowId}
          `;
        }
      } catch (outlookError) {
        // Outlook sync failure is non-critical - booking is already finalized
        console.error('[finalizeCore] Outlook sync failed:', outlookError);
        await sql`
          UPDATE bookings 
          SET outlook_sync_status = 'failed'
          WHERE id = ${ensuredBookingRowId}
        `;
      }
    }

    // Sync customer to Brevo using database data (ensures we sync latest data, not just payment intent metadata)
    // Also sync used_welcome_offer status to Brevo
    if (customerId) {
      try {
        const syncResult = await syncCustomerToBrevo({
          customerId,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
          tags: ['booked', svcId || 'service'],
        });
        
        if (syncResult.success) {
          console.log(`[finalizeCore] Successfully synced customer ${customerId} to Brevo with ID ${syncResult.brevoId}`);
        } else if (syncResult.brevoId) {
          // Partial success - got contact ID but update may have failed
          console.warn(`[finalizeCore] Customer ${customerId} exists in Brevo (ID: ${syncResult.brevoId}) but update may have failed`);
        } else {
          console.warn(`[finalizeCore] Failed to sync customer ${customerId} to Brevo - may not have marketing opt-in enabled`);
        }
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
        const { EST_TIMEZONE } = await import('../timezone');
        const bookingTime = bookingDate.toLocaleTimeString('en-US', {
          timeZone: EST_TIMEZONE,
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
        // Use internal booking ID for customer-facing links
        const emailHtml = generateBookingConfirmationEmail({
          serviceName: serviceDisplayName,
          serviceImageUrl,
          clientName: fullNameFromPi,
          bookingDate,
          bookingTime,
          bookingId: ensuredBookingRowId || args.hapioBookingId, // Use internal ID or fallback to Hapio ID
          calendarLinks,
        });

        // Note: Stripe will automatically send receipt emails separately when Customer emails → Successful payments is enabled
        // We set receipt_email on the PaymentIntent, so Stripe handles receipt delivery
        await sendBrevoEmail({
          to: [{ email: emailFromPi, name: fullNameFromPi || undefined }],
          subject: `Your ${serviceDisplayName} appointment is confirmed`,
          htmlContent: emailHtml,
          tags: ['booking_confirmed'],
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


