import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { stripe } from '@/lib/stripeClient';
import { sendBrevoEmail } from '@/lib/brevoClient';
import Stripe from 'stripe';

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

function generateUniqueCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding 0, O, 1, I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, customerEmail, customerName, discountType, discountValue, expiresInDays } = body;

    // Validate inputs
    if (!customerId && !customerEmail) {
      return NextResponse.json(
        { error: 'Either customerId or customerEmail is required' },
        { status: 400 }
      );
    }

    if (!discountType || !['percent', 'dollar'].includes(discountType)) {
      return NextResponse.json(
        { error: 'discountType must be "percent" or "dollar"' },
        { status: 400 }
      );
    }

    if (!discountValue || discountValue <= 0) {
      return NextResponse.json(
        { error: 'discountValue must be greater than 0' },
        { status: 400 }
      );
    }

    if (discountType === 'percent' && discountValue > 100) {
      return NextResponse.json(
        { error: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    // Find customer if only email provided
    let finalCustomerId: string | null = customerId || null;
    let finalCustomerEmail: string | null = customerEmail || null;
    let finalCustomerName: string | null = customerName || null;

    if (!finalCustomerId && finalCustomerEmail) {
      const customerResult = await sql`
        SELECT id, email, first_name, last_name 
        FROM customers 
        WHERE LOWER(email) = LOWER(${finalCustomerEmail})
        LIMIT 1
      `;
      const customerRows = normalizeRows(customerResult);
      if (customerRows.length > 0) {
        finalCustomerId = customerRows[0].id;
        finalCustomerEmail = customerRows[0].email;
        if (!finalCustomerName) {
          finalCustomerName = `${customerRows[0].first_name || ''} ${customerRows[0].last_name || ''}`.trim() || null;
        }
      }
    } else if (finalCustomerId) {
      const customerResult = await sql`
        SELECT email, first_name, last_name 
        FROM customers 
        WHERE id = ${finalCustomerId}
        LIMIT 1
      `;
      const customerRows = normalizeRows(customerResult);
      if (customerRows.length > 0) {
        finalCustomerEmail = customerRows[0].email;
        if (!finalCustomerName) {
          finalCustomerName = `${customerRows[0].first_name || ''} ${customerRows[0].last_name || ''}`.trim() || null;
        }
      }
    }

    if (!finalCustomerEmail) {
      return NextResponse.json(
        { error: 'Customer email not found' },
        { status: 404 }
      );
    }

    // Generate unique code (check both one_time_discount_codes and discount_codes tables)
    let code: string;
    let attempts = 0;
    const maxAttempts = 20; // Increased from 10 for better collision handling
    do {
      code = generateUniqueCode();
      const [oneTimeCheck, regularCheck] = await Promise.all([
        sql`SELECT id FROM one_time_discount_codes WHERE code = ${code} LIMIT 1`,
        sql`SELECT id FROM discount_codes WHERE code = ${code} LIMIT 1`,
      ]);
      if (normalizeRows(oneTimeCheck).length === 0 && normalizeRows(regularCheck).length === 0) {
        break;
      }
      attempts++;
      if (attempts >= maxAttempts) {
        return NextResponse.json(
          { error: 'Failed to generate unique code after multiple attempts' },
          { status: 500 }
        );
      }
    } while (true);

    // Calculate expiration date
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Create Stripe coupon FIRST (before DB insert to avoid orphaned DB records)
    // If Stripe fails, we don't create DB record
    let stripeCouponId: string | null = null;
    try {
      const couponName = `One-time: ${code}`;
      
      let coupon: Stripe.Coupon;
      if (discountType === 'percent') {
        coupon = await stripe.coupons.create({
          name: couponName,
          duration: 'once',
          percent_off: Math.round(discountValue),
          metadata: {
            one_time_code: code,
            customer_id: finalCustomerId || '',
            discount_type: discountType,
          },
        });
      } else {
        coupon = await stripe.coupons.create({
          name: couponName,
          duration: 'once',
          amount_off: Math.round(discountValue * 100), // Stripe uses cents
          currency: 'usd',
          metadata: {
            one_time_code: code,
            customer_id: finalCustomerId || '',
            discount_type: discountType,
          },
        });
      }
      
      stripeCouponId = coupon.id;
    } catch (stripeError: any) {
      console.error('[Generate Discount Code] Stripe coupon creation failed:', stripeError);
      return NextResponse.json(
        { error: 'Failed to create Stripe coupon', details: stripeError.message },
        { status: 500 }
      );
    }

    // Insert into database (only after Stripe succeeds to avoid orphaned records)
    const insertResult = await sql`
      INSERT INTO one_time_discount_codes (
        customer_id, code, discount_type, discount_value, 
        expires_at, stripe_coupon_id, created_by
      )
      VALUES (
        ${finalCustomerId}, ${code}, ${discountType}, ${discountValue},
        ${expiresAt}, ${stripeCouponId}, 'admin'
      )
      RETURNING id, code, discount_type, discount_value, expires_at, created_at
    `;
    const inserted = normalizeRows(insertResult)[0];

    // Send email to customer
    try {
      const discountDisplay = discountType === 'percent' 
        ? `${discountValue}% off`
        : `$${discountValue} off`;

      // Escape HTML to prevent XSS
      const escapeHtml = (text: string | null): string => {
        if (!text) return '';
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      const safeCustomerName = escapeHtml(finalCustomerName);
      const safeCode = escapeHtml(code);
      const safeDiscountDisplay = escapeHtml(discountDisplay);
      const safeExpiresAt = expiresAt ? escapeHtml(new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })) : '';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Special Discount Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Aura Wellness Aesthetics</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #2d5016;">Your Special Discount Code</h2>
            <p>Hi ${safeCustomerName || 'there'},</p>
            <p>We're excited to offer you a special discount on your next service!</p>
            <div style="background: white; border: 2px dashed #4a7c2a; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #666;">Your discount code:</p>
              <p style="margin: 10px 0; font-size: 32px; font-weight: bold; color: #2d5016; letter-spacing: 2px;">${safeCode}</p>
              <p style="margin: 0; font-size: 16px; color: #4a7c2a; font-weight: bold;">${safeDiscountDisplay}</p>
            </div>
            <p>Use this code at checkout to redeem your ${safeDiscountDisplay} discount.</p>
            ${safeExpiresAt ? `<p style="color: #666; font-size: 14px;">This code expires on ${safeExpiresAt}.</p>` : ''}
            <p style="margin-top: 30px;">
              <a href="https://theauraesthetics.com/services" style="background: #4a7c2a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Book Your Service</a>
            </p>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              Thank you for being a valued client!<br>
              <strong>Aura Wellness Aesthetics</strong>
            </p>
          </div>
        </body>
        </html>
      `;

      await sendBrevoEmail({
        to: [{ email: finalCustomerEmail, name: finalCustomerName || undefined }],
        subject: `Your Special Discount Code - ${discountDisplay}`,
        htmlContent: emailHtml,
        tags: ['discount_code', 'one_time_offer'],
      });

      // Mark email as sent
      await sql`
        UPDATE one_time_discount_codes 
        SET email_sent = true, email_sent_at = NOW()
        WHERE id = ${inserted.id}
      `;
    } catch (emailError: any) {
      console.error('[Generate Discount Code] Email send failed:', emailError);
      // Don't fail the request if email fails - code is still created
    }

    return NextResponse.json({
      success: true,
      code: {
        id: inserted.id,
        code: inserted.code,
        discountType: inserted.discount_type,
        discountValue: Number(inserted.discount_value),
        expiresAt: inserted.expires_at,
        createdAt: inserted.created_at,
      },
    });
  } catch (error: any) {
    console.error('[Generate Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

