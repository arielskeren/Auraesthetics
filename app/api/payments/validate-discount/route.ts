import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSqlClient } from '@/app/_utils/db';

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
            SELECT used_welcome_offer, email, first_name, last_name 
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
            // New customer - check if someone with the same email/name combination has used it
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
        // Only name provided - check for duplicates (only if column exists)
        if (hasWelcomeOfferColumn) {
          const nameParts = customerName.trim().split(/\s+/).filter(Boolean);
          if (nameParts.length >= 2) {
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            
            const nameCheck = await sql`
              SELECT used_welcome_offer 
              FROM customers 
              WHERE LOWER(first_name) = LOWER(${firstName})
                AND LOWER(last_name) = LOWER(${lastName})
                AND used_welcome_offer = true
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
      }
    }

    // Check database for discount code (both regular and one-time codes)
    const sql = getSqlClient();
    
    // Check if one_time_discount_codes table exists
    let hasOneTimeTable = false;
    try {
      const tableCheck = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'one_time_discount_codes'
        LIMIT 1
      `;
      hasOneTimeTable = normalizeRows(tableCheck).length > 0;
    } catch (e) {
      // If check fails, assume table doesn't exist
      hasOneTimeTable = false;
    }
    
    let discountCode: any = null;
    let stripeCouponId: string | null = null;
    let isOneTime = false;

    // First check one-time discount codes (if table exists)
    if (hasOneTimeTable) {
      try {
        const oneTimeResult = await sql`
          SELECT * FROM one_time_discount_codes 
          WHERE code = ${codeUpper}
            AND used = false
            AND (expires_at IS NULL OR expires_at > NOW())
        `;
        const oneTimeRows = normalizeRows(oneTimeResult);
        
        if (oneTimeRows.length > 0) {
          // One-time code found
          discountCode = oneTimeRows[0];
          stripeCouponId = discountCode.stripe_coupon_id;
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
        // If one-time table query fails, continue to regular discount codes
        console.warn('[Discount Validation] One-time discount codes table query failed:', e);
      }
    }

    // If no one-time code found, check regular discount codes
    if (!discountCode) {
      const dbResult = await sql`
        SELECT * FROM discount_codes 
        WHERE code = ${codeUpper} 
        AND is_active = true
      `;
      const discountRows = normalizeRows(dbResult);

      if (discountRows.length === 0) {
        return NextResponse.json(
          { error: 'Invalid discount code', valid: false },
          { status: 400 }
        );
      }

      discountCode = discountRows[0];
      stripeCouponId = discountCode.stripe_coupon_id;
    }

    // Validate coupon with Stripe
    try {
      if (!stripeCouponId) {
        return NextResponse.json(
          { error: 'Invalid discount code - no Stripe coupon ID', valid: false },
          { status: 400 }
        );
      }
      const coupon = await stripe.coupons.retrieve(stripeCouponId);

      // Check if coupon is valid
      if (!coupon.valid) {
        return NextResponse.json(
          { error: 'Discount code is no longer valid', valid: false },
          { status: 400 }
        );
      }

      // Calculate discount amount
      let discountAmount = 0;
      let finalAmount = amount;

      if (coupon.percent_off) {
        // Percentage discount
        const discount = (amount * coupon.percent_off) / 100;
        discountAmount = discount;
        
        // Apply max discount if specified (for WELCOME15, max $30)
        // Check coupon metadata or hardcode for known coupons
        let maxDiscount = 0;
        if (coupon.metadata?.max_discount) {
          maxDiscount = parseFloat(coupon.metadata.max_discount);
        } else if (coupon.id === 'L0DshEg5' || code.toUpperCase() === 'WELCOME15') {
          // WELCOME15 has a $30 cap
          maxDiscount = 30;
        }
        
        if (maxDiscount > 0 && discountAmount > maxDiscount) {
          discountAmount = maxDiscount;
        }
        finalAmount = amount - discountAmount;
      } else if (coupon.amount_off) {
        // Fixed amount discount
        discountAmount = coupon.amount_off / 100; // Stripe stores in cents
        finalAmount = Math.max(0, amount - discountAmount);
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
        coupon: {
          id: coupon.id,
          name: coupon.name,
          percent_off: coupon.percent_off,
          amount_off: coupon.amount_off ? coupon.amount_off / 100 : null,
        },
      });
    } catch (stripeError: any) {
      console.error('Stripe coupon validation error:', stripeError);
      return NextResponse.json(
        { error: 'Error validating discount code', valid: false },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Discount validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

