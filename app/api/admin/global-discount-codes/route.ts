import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { stripe } from '@/lib/stripeClient';

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

export const dynamic = 'force-dynamic';

// GET /api/admin/global-discount-codes - List all global discount codes
export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();

    // Check if table exists
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'discount_codes'
      LIMIT 1
    `;
    const hasTable = normalizeRows(tableCheck).length > 0;

    if (!hasTable) {
      console.warn('[Global Discount Codes API] Table discount_codes does not exist');
      return NextResponse.json({ 
        codes: [],
        warning: 'Discount codes table does not exist',
      });
    }

    // Fetch all global discount codes
    // Note: Run migration 010_add_global_discount_code_fields.sql first
    const codesResult = await sql`
      SELECT 
        id,
        code,
        COALESCE(discount_type, 'percent') as discount_type,
        discount_value,
        discount_cap,
        stripe_coupon_id,
        stripe_promotion_code_id,
        is_active,
        max_uses,
        expires_at,
        created_at,
        updated_at
      FROM discount_codes
      ORDER BY created_at DESC
    `;
    const codes = normalizeRows(codesResult);

    // For each code, get usage count from Stripe
    const codesWithUsage = await Promise.all(
      codes.map(async (code) => {
        let usageCount = 0;
        let timesRedeemed = 0;

        if (code.stripe_coupon_id) {
          try {
            const coupon = await stripe.coupons.retrieve(code.stripe_coupon_id);
            timesRedeemed = coupon.times_redeemed || 0;
            
            // Also check promotion codes if they exist
            if (coupon.id) {
              const promotionCodes = await stripe.promotionCodes.list({
                coupon: coupon.id,
                limit: 100,
              });
              
              // Sum up times_redeemed from all promotion codes
              usageCount = promotionCodes.data.reduce((sum, pc) => {
                return sum + (pc.times_redeemed || 0);
              }, 0);
              
              // If no promotion codes, use coupon times_redeemed
              if (usageCount === 0) {
                usageCount = timesRedeemed;
              }
            } else {
              usageCount = timesRedeemed;
            }
          } catch (e) {
            console.error(`[Global Discount Codes] Error fetching Stripe usage for ${code.code}:`, e);
          }
        }

        return {
          ...code,
          usage_count: usageCount,
          times_redeemed: timesRedeemed,
        };
      })
    );

    return NextResponse.json({ codes: codesWithUsage });
  } catch (error: any) {
    console.error('[Global Discount Codes API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch global discount codes', 
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/global-discount-codes - Create a new global discount code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      code, 
      discountType, 
      discountValue, 
      discountCap, 
      maxUses, 
      expiresInDays,
      isActive = true 
    } = body;

    // Validation
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required' },
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
    const codeUpper = code.toUpperCase();

    // Check if code already exists
    const existingCheck = await sql`
      SELECT id FROM discount_codes WHERE code = ${codeUpper} LIMIT 1
    `;
    if (normalizeRows(existingCheck).length > 0) {
      return NextResponse.json(
        { error: 'Discount code already exists' },
        { status: 400 }
      );
    }

    // Calculate expiration date
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    }

    // Create Stripe coupon
    const couponName = `Global: ${codeUpper}`;
    let coupon;
    if (discountType === 'percent') {
      const couponParams: any = {
        name: couponName,
        duration: 'once', // Each customer can use it once
        percent_off: Math.round(discountValue),
        metadata: {
          global_code: codeUpper,
          discount_type: discountType,
        },
      };
      if (discountCap) {
        couponParams.metadata.discount_cap = String(discountCap);
      }
      if (maxUses && maxUses > 0) {
        couponParams.max_redemptions = maxUses;
      }
      coupon = await stripe.coupons.create(couponParams);
    } else {
      coupon = await stripe.coupons.create({
        name: couponName,
        duration: 'once',
        amount_off: Math.round(discountValue * 100),
        currency: 'usd',
        metadata: {
          global_code: codeUpper,
          discount_type: discountType,
        },
        ...(maxUses && maxUses > 0 ? { max_redemptions: maxUses } : {}),
      });
    }

    // Create promotion code for the coupon
    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: codeUpper,
      active: isActive,
    });

    // Insert into database
    await sql`
      INSERT INTO discount_codes (
        code,
        discount_type,
        discount_value,
        discount_cap,
        stripe_coupon_id,
        stripe_promotion_code_id,
        is_active,
        max_uses,
        expires_at,
        created_at,
        updated_at
      ) VALUES (
        ${codeUpper},
        ${discountType},
        ${discountValue},
        ${discountCap || null},
        ${coupon.id},
        ${promotionCode.id},
        ${isActive},
        ${maxUses || null},
        ${expiresAt},
        NOW(),
        NOW()
      )
    `;

    return NextResponse.json({ 
      success: true,
      message: 'Global discount code created successfully',
    });
  } catch (error: any) {
    console.error('[Create Global Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create global discount code', details: error.message },
      { status: 500 }
    );
  }
}

