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
    const { customerId, customerEmail, customerName, discountType, discountValue, discountCap, expiresInDays } = body;

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

    // Validate discount cap (only for percentage discounts)
    if (discountCap !== undefined && discountCap !== null) {
      if (discountType !== 'percent') {
        return NextResponse.json(
          { error: 'Discount cap can only be set for percentage discounts' },
          { status: 400 }
        );
      }
      if (discountCap <= 0) {
        return NextResponse.json(
          { error: 'Discount cap must be greater than 0' },
          { status: 400 }
        );
      }
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

    // Check if one_time_discount_codes table exists
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'one_time_discount_codes'
      LIMIT 1
    `;
    const hasOneTimeTable = normalizeRows(tableCheck).length > 0;
    
    if (!hasOneTimeTable) {
      return NextResponse.json(
        { 
          error: 'One-time discount codes table does not exist. Please run migration 006_create_one_time_discount_codes.sql',
          details: 'The one_time_discount_codes table is required for generating one-time discount codes.'
        },
        { status: 500 }
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
        // For percentage discounts with a cap, we need to use max_redemptions or handle it differently
        // Stripe doesn't natively support percentage caps, so we'll store it in metadata
        // The cap will be enforced in the validation logic
        const couponParams: Stripe.CouponCreateParams = {
          name: couponName,
          duration: 'once',
          percent_off: Math.round(discountValue),
          metadata: {
            one_time_code: code,
            customer_id: finalCustomerId || '',
            discount_type: discountType,
          },
        };
        
        // Add discount cap to metadata if provided
        if (discountCap !== undefined && discountCap !== null) {
          couponParams.metadata = {
            ...couponParams.metadata,
            discount_cap: String(discountCap),
          };
        }
        
        coupon = await stripe.coupons.create(couponParams);
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
      
      stripeCouponId = String(coupon.id).trim();
      if (!stripeCouponId || stripeCouponId.length === 0) {
        throw new Error('Invalid coupon ID returned from Stripe');
      }
      console.log('[Generate Discount Code] Stripe coupon created successfully:', stripeCouponId);
    } catch (stripeError: any) {
      console.error('[Generate Discount Code] Stripe coupon creation failed:', {
        error: stripeError.message,
        code: stripeError.code,
        type: stripeError.type,
      });
      return NextResponse.json(
        { error: 'Failed to create Stripe coupon', details: stripeError.message },
        { status: 500 }
      );
    }

    // Insert into database (only after Stripe succeeds to avoid orphaned records)
    // Wrap in try-catch to handle DB failures and clean up Stripe resources
    let inserted: any;
    try {
      const insertResult = await sql`
        INSERT INTO one_time_discount_codes (
          customer_id, code, discount_type, discount_value, discount_cap,
          expires_at, stripe_coupon_id, created_by
        )
        VALUES (
          ${finalCustomerId}, ${code}, ${discountType}, ${discountValue}, 
          ${discountCap || null}, ${expiresAt}, ${stripeCouponId}, 'admin'
        )
        RETURNING id, code, discount_type, discount_value, discount_cap, expires_at, created_at
      `;
      inserted = normalizeRows(insertResult)[0];
      
      if (!inserted || !inserted.id) {
        throw new Error('Database insert returned invalid result');
      }
      console.log('[Generate Discount Code] Successfully inserted into one_time_discount_codes table:', inserted.id);
    } catch (dbError: any) {
      console.error('[Generate Discount Code] Database insert failed:', {
        error: dbError.message,
        code: code,
        stripeCouponId: stripeCouponId,
      });
      
      // If DB insert fails, clean up Stripe coupon to avoid orphaned resources
      if (stripeCouponId) {
        try {
          await stripe.coupons.del(stripeCouponId);
          console.log('[Generate Discount Code] Cleaned up orphaned Stripe coupon:', stripeCouponId);
        } catch (cleanupError) {
          console.error('[Generate Discount Code] Failed to clean up Stripe coupon after DB failure:', cleanupError);
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to save discount code to database', 
          details: dbError.message,
        },
        { status: 500 }
      );
    }

    // Send email to customer
    try {
      let discountDisplay: string;
      if (discountType === 'percent') {
        if (discountCap !== undefined && discountCap !== null) {
          discountDisplay = `${discountValue}% off (up to $${discountCap})`;
        } else {
          discountDisplay = `${discountValue}% off`;
        }
      } else {
        discountDisplay = `$${discountValue} off`;
      }

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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f0;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f0;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: 0.5px;">Aura Wellness Aesthetics</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #2d5016; font-size: 24px; font-weight: 600;">Your Special Discount Code</h2>
              
              <p style="margin: 0 0 15px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi ${safeCustomerName || 'there'},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                We're excited to offer you a special discount on your next service!
              </p>

              <!-- Discount Code Box -->
              <div style="background: linear-gradient(135deg, #f9f9f9 0%, #ffffff 100%); border: 3px dashed #4a7c2a; padding: 30px 20px; text-align: center; margin: 30px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(74, 124, 42, 0.1);">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Discount Code</p>
                <p style="margin: 15px 0; font-size: 42px; font-weight: bold; color: #2d5016; letter-spacing: 4px; font-family: 'Courier New', monospace;">${safeCode}</p>
                <div style="display: inline-block; background-color: #4a7c2a; color: #ffffff; padding: 8px 20px; border-radius: 20px; margin-top: 10px;">
                  <p style="margin: 0; font-size: 18px; font-weight: 600;">${safeDiscountDisplay}</p>
                </div>
              </div>

              <p style="margin: 25px 0; color: #333333; font-size: 16px; line-height: 1.6; text-align: center;">
                Use this code at checkout to redeem your <strong style="color: #2d5016;">${safeDiscountDisplay}</strong> discount.
              </p>
              ${discountType === 'percent' && discountCap ? `
                <div style="background-color: #e8f5e9; border-left: 4px solid #4a7c2a; padding: 12px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #2d5016; font-size: 14px; line-height: 1.6;">
                    <strong>💡 Note:</strong> This ${discountValue}% discount is capped at a maximum savings of $${discountCap}.
                  </p>
                </div>
              ` : ''}
              
              ${safeExpiresAt ? `
                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                    <strong>⏰ Expires:</strong> ${safeExpiresAt}
                  </p>
                </div>
              ` : ''}

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 35px 0; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="https://www.theauraesthetics.com/book" style="display: inline-block; background-color: #4a7c2a; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(74, 124, 42, 0.3); transition: background-color 0.3s;">
                      Book Your Service
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <div style="border-top: 1px solid #e0e0e0; padding-top: 25px; margin-top: 35px;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6; text-align: center;">
                  Thank you for being a valued client!
                </p>
                <p style="margin: 15px 0 0 0; color: #999999; font-size: 13px; line-height: 1.6; font-style: italic; text-align: center;">
                  Warm regards,<br>
                  <strong style="color: #2d5016;">Amy & The Aura Wellness Aesthetics Team</strong>
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();

      await sendBrevoEmail({
        to: [{ email: finalCustomerEmail, name: finalCustomerName || undefined }],
        subject: `Your Special Discount Code - ${discountDisplay}`,
        htmlContent: emailHtml,
        tags: ['discount_code', 'one_time_offer'],
      });

      // Mark email as sent (if column exists)
      try {
        await sql`
          UPDATE one_time_discount_codes 
          SET email_sent = true, email_sent_at = NOW()
          WHERE id = ${inserted.id}
        `;
      } catch (e) {
        // Column might not exist - non-critical
        console.warn('[Generate Discount Code] email_sent column may not exist');
      }
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
        discountCap: inserted.discount_cap ? Number(inserted.discount_cap) : null,
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

