import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { rateLimit, getClientIp } from '@/app/_utils/rateLimit';

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

// Rate limiter: 20 requests per minute per IP
const limiter = rateLimit({ windowMs: 60 * 1000, maxRequests: 20 });

export async function POST(request: NextRequest) {
  // Check rate limit
  const clientIp = getClientIp(request);
  const rateLimitCheck = limiter.check(clientIp);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimitCheck.resetAt).toISOString(),
        },
      }
    );
  }

  let body: any = null;
  try {
    body = await request.json();
    const { code, amount, customerEmail, customerName } = body;

    // Validate input
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Discount code is required' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    const codeUpper = code.toUpperCase();

    // Special validation for WELCOME15 offer
    if (codeUpper === 'WELCOME15') {
      const sql = getSqlClient();
      
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
        hasWelcomeOfferColumn = normalizeRows(columnCheck).length > 0;
      } catch (e) {
        // If check fails, assume column doesn't exist
        hasWelcomeOfferColumn = false;
      }
      
      // Check if customer email has already used the welcome offer
      if (customerEmail && typeof customerEmail === 'string') {
        const emailLower = customerEmail.toLowerCase().trim();
        
        if (hasWelcomeOfferColumn) {
          const customerCheck = await sql`
            SELECT id, used_welcome_offer, email, first_name, last_name 
            FROM customers 
            WHERE LOWER(email) = ${emailLower}
            LIMIT 1
          `;
          const customerRows = normalizeRows(customerCheck);
        
          if (customerRows.length > 0) {
            const customer = customerRows[0];
            
            // Check if this customer has already used the welcome offer
            if (customer.used_welcome_offer === true) {
              return NextResponse.json(
                { error: 'This welcome offer has already been used', valid: false },
                { status: 400 }
              );
            }
            
            // CRITICAL CHECK 1: Is this their first booking?
            // Check if customer has any completed bookings (payment_status = 'paid' or 'completed')
            // Check by both customer_id (if exists) and email (fallback)
            const previousBookingsCheck = await sql`
              SELECT COUNT(*) as booking_count
              FROM bookings
              WHERE (
                customer_id = ${customer.id}
                OR LOWER(client_email) = ${emailLower}
              )
                AND payment_status IN ('paid', 'completed')
              LIMIT 1
            `;
            const bookingCount = normalizeRows(previousBookingsCheck)[0]?.booking_count || 0;
            
            if (bookingCount > 0) {
              return NextResponse.json(
                { error: 'This welcome offer is only valid for your first service booking', valid: false },
                { status: 400 }
              );
            }
            
            // CRITICAL CHECK 2: Have they ever used any other discount code?
            // Check bookings table for any discount codes used (by customer_id or email)
            const otherDiscountCheck = await sql`
              SELECT COUNT(*) as discount_count
              FROM bookings
              WHERE (
                customer_id = ${customer.id}
                OR LOWER(client_email) = ${emailLower}
              )
                AND (
                  metadata->>'discountCode' IS NOT NULL 
                  AND metadata->>'discountCode' != ''
                  AND UPPER(metadata->>'discountCode') != 'WELCOME15'
                )
              LIMIT 1
            `;
            const otherDiscountCount = normalizeRows(otherDiscountCheck)[0]?.discount_count || 0;
            
            // Also check booking_events for discount codes
            const bookingEventsDiscountCheck = await sql`
              SELECT COUNT(*) as discount_count
              FROM booking_events be
              JOIN bookings b ON be.booking_id = b.id
              WHERE (
                b.customer_id = ${customer.id}
                OR LOWER(b.client_email) = ${emailLower}
              )
                AND be.type = 'finalized'
                AND (
                  be.data->>'discountCode' IS NOT NULL 
                  AND be.data->>'discountCode' != ''
                  AND UPPER(be.data->>'discountCode') != 'WELCOME15'
                )
              LIMIT 1
            `;
            const eventsDiscountCount = normalizeRows(bookingEventsDiscountCheck)[0]?.discount_count || 0;
            
            if (otherDiscountCount > 0 || eventsDiscountCount > 0) {
              return NextResponse.json(
                { error: 'This welcome offer cannot be used if you have previously used any other discount code', valid: false },
                { status: 400 }
              );
            }
            
            // Check for duplicate name if name is provided
            if (customerName && typeof customerName === 'string') {
              const nameParts = customerName.trim().split(/\s+/).filter(Boolean);
              if (nameParts.length >= 2) {
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ');
                
                // Check if another customer with same name has used the offer
                const nameCheck = await sql`
                  SELECT used_welcome_offer 
                  FROM customers 
                  WHERE LOWER(first_name) = LOWER(${firstName})
                    AND LOWER(last_name) = LOWER(${lastName})
                    AND used_welcome_offer = true
                    AND LOWER(email) != ${emailLower}
                  LIMIT 1
                `;
                const nameRows = normalizeRows(nameCheck);
                
                if (nameRows.length > 0) {
                  return NextResponse.json(
                    { error: 'This welcome offer has already been used by someone with this name', valid: false },
                    { status: 400 }
                  );
                }
              }
            }
          } else {
            // New customer (not in customers table yet)
            // CRITICAL CHECK 1: Check if this email has any previous bookings
            const previousBookingsCheck = await sql`
              SELECT COUNT(*) as booking_count
              FROM bookings
              WHERE LOWER(client_email) = ${emailLower}
                AND payment_status IN ('paid', 'completed')
              LIMIT 1
            `;
            const bookingCount = normalizeRows(previousBookingsCheck)[0]?.booking_count || 0;
            
            if (bookingCount > 0) {
              return NextResponse.json(
                { error: 'This welcome offer is only valid for your first service booking', valid: false },
                { status: 400 }
              );
            }
            
            // CRITICAL CHECK 2: Check if this email has used any other discount codes
            const otherDiscountCheck = await sql`
              SELECT COUNT(*) as discount_count
              FROM bookings
              WHERE LOWER(client_email) = ${emailLower}
                AND (
                  metadata->>'discountCode' IS NOT NULL 
                  AND metadata->>'discountCode' != ''
                  AND UPPER(metadata->>'discountCode') != 'WELCOME15'
                )
              LIMIT 1
            `;
            const otherDiscountCount = normalizeRows(otherDiscountCheck)[0]?.discount_count || 0;
            
            // Also check booking_events for discount codes
            const bookingEventsDiscountCheck = await sql`
              SELECT COUNT(*) as discount_count
              FROM booking_events be
              JOIN bookings b ON be.booking_id = b.id
              WHERE LOWER(b.client_email) = ${emailLower}
                AND be.type = 'finalized'
                AND (
                  be.data->>'discountCode' IS NOT NULL 
                  AND be.data->>'discountCode' != ''
                  AND UPPER(be.data->>'discountCode') != 'WELCOME15'
                )
              LIMIT 1
            `;
            const eventsDiscountCount = normalizeRows(bookingEventsDiscountCheck)[0]?.discount_count || 0;
            
            if (otherDiscountCount > 0 || eventsDiscountCount > 0) {
              return NextResponse.json(
                { error: 'This welcome offer cannot be used if you have previously used any other discount code', valid: false },
                { status: 400 }
              );
            }
            
            // Check if someone with the same email/name combination has used it
            if (customerName && typeof customerName === 'string') {
              const nameParts = customerName.trim().split(/\s+/).filter(Boolean);
              if (nameParts.length >= 2) {
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ');
                
                const duplicateCheck = await sql`
                  SELECT used_welcome_offer 
                  FROM customers 
                  WHERE (LOWER(email) = LOWER(${customerEmail}) 
                     OR (LOWER(first_name) = LOWER(${firstName}) AND LOWER(last_name) = LOWER(${lastName})))
                    AND used_welcome_offer = true
                  LIMIT 1
                `;
                const duplicateRows = normalizeRows(duplicateCheck);
                
                if (duplicateRows.length > 0) {
                  return NextResponse.json(
                    { error: 'This welcome offer has already been used', valid: false },
                    { status: 400 }
                  );
                }
              }
            }
          }
        } else {
          // Column doesn't exist - skip welcome offer validation
          console.warn('[Discount Validation] used_welcome_offer column does not exist, skipping WELCOME15 validation');
        }
      } else if (customerName && typeof customerName === 'string') {
        // Only name provided - require email for WELCOME15 validation
        return NextResponse.json(
          { 
            error: 'Please enter your email address to verify your eligibility for this welcome offer', 
            valid: false,
            requiresEmail: true 
          },
          { status: 400 }
        );
      } else {
        // No email or name provided - require email for WELCOME15
        return NextResponse.json(
          { 
            error: 'Please enter your email address to verify your eligibility for this welcome offer', 
            valid: false,
            requiresEmail: true 
          },
          { status: 400 }
        );
      }
    }

    // Check database for discount code (both one-time and global codes in unified table)
    const sql = getSqlClient();
    
    let discountCode: any = null;
    let isOneTime = false;

    // First check one-time discount codes
    try {
      const oneTimeResult = await sql`
        SELECT id, code, customer_id, discount_type, discount_value, discount_cap, stripe_coupon_id, used, expires_at, code_type
        FROM discount_codes 
        WHERE code = ${codeUpper}
          AND code_type = 'one_time'
          AND used = false
          AND (is_active IS NULL OR is_active = true)
          AND (expires_at IS NULL OR expires_at > NOW())
      `;
      const oneTimeRows = normalizeRows(oneTimeResult);
      
      if (oneTimeRows.length > 0) {
        // One-time code found
        discountCode = oneTimeRows[0];
        isOneTime = true;
        
        // CRITICAL: If code is customer-specific, require email for validation
        if (discountCode.customer_id) {
          if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.trim()) {
            return NextResponse.json(
              { 
                error: 'Please enter your email address to verify your eligibility for this discount code', 
                valid: false,
                requiresEmail: true 
              },
              { status: 400 }
            );
          }
          
          // Verify customer matches
          const customerCheck = await sql`
            SELECT id FROM customers 
            WHERE id = ${discountCode.customer_id} 
              AND LOWER(email) = LOWER(${customerEmail.trim()})
            LIMIT 1
          `;
          if (normalizeRows(customerCheck).length === 0) {
            return NextResponse.json(
              { error: 'This discount code is not valid for your account', valid: false },
              { status: 400 }
            );
          }
        }
      }
    } catch (e) {
      // If query fails, continue to global discount codes
      console.warn('[Discount Validation] One-time discount codes query failed:', e);
    }

    // If no one-time code found, check global discount codes
    if (!discountCode) {
      const dbResult = await sql`
        SELECT * FROM discount_codes 
        WHERE code = ${codeUpper} 
        AND code_type = 'global'
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      `;
      const discountRows = normalizeRows(dbResult);

      if (discountRows.length === 0) {
        return NextResponse.json(
          { error: 'Invalid discount code', valid: false },
          { status: 400 }
        );
      }

      discountCode = discountRows[0];
      
      // Check max_uses limit (if set)
      if (discountCode.max_uses !== null && discountCode.max_uses !== undefined) {
        const usageCount = discountCode.usage_count || 0;
        if (usageCount >= discountCode.max_uses) {
          return NextResponse.json(
            { error: 'This discount code has reached its usage limit', valid: false },
            { status: 400 }
          );
        }
      }
    }

    // Calculate discount amount from database fields (no Stripe dependency)
    if (!discountCode) {
      return NextResponse.json(
        { error: 'Invalid discount code', valid: false },
        { status: 400 }
      );
    }

    // Calculate discount amount
    let discountAmount = 0;
    let finalAmount = amount;

    if (discountCode.discount_type === 'percent') {
      // Percentage discount
      const discount = (amount * Number(discountCode.discount_value)) / 100;
      discountAmount = discount;
      
      // Apply max discount cap if specified
      if (discountCode.discount_cap) {
        const maxDiscount = Number(discountCode.discount_cap);
        if (maxDiscount > 0 && discountAmount > maxDiscount) {
          discountAmount = maxDiscount;
        }
      }
      finalAmount = amount - discountAmount;
    } else if (discountCode.discount_type === 'dollar') {
      // Fixed amount discount
      discountAmount = Number(discountCode.discount_value);
      finalAmount = Math.max(0, amount - discountAmount);
    } else {
      return NextResponse.json(
        { error: 'Invalid discount type', valid: false },
        { status: 400 }
      );
    }

      // NOTE: We do NOT mark one-time codes as used here
      // Codes should only be marked as used AFTER successful payment
      // This validation is just checking if the code is valid
      // The code will be marked as used in finalizeCore when payment succeeds
      
    // Return validation result (code is valid, but not yet used)
    return NextResponse.json({
      valid: true,
      code: code.toUpperCase(),
      discountAmount: Math.round(discountAmount * 100) / 100,
      originalAmount: amount,
      finalAmount: Math.round(finalAmount * 100) / 100,
      isOneTime,
      discountType: discountCode.discount_type,
      discountValue: discountCode.discount_value,
      discountCap: discountCode.discount_cap || null,
    });
  } catch (error: any) {
    console.error('[Discount Validation] Error:', {
      code: body?.code,
      customerEmail: body?.customerEmail,
      error: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

