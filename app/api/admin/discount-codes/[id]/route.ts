import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { stripe } from '@/lib/stripeClient';
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

export const dynamic = 'force-dynamic';

// PATCH /api/admin/discount-codes/[id] - Update discount code
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const body = await request.json();
    const { discountType, discountValue, discountCap, expiresOn, expiresInDays } = body; // expiresInDays for legacy support

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

    // Validate discount cap
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

    // Fetch existing code (one-time codes only)
    const codeResult = await sql`
      SELECT id, code, discount_type, discount_value, discount_cap, stripe_coupon_id, used, expires_at, code_type
      FROM discount_codes
      WHERE id = ${codeId} AND code_type = 'one_time'
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const existingCode = codeRows[0];

    // Don't allow editing used codes
    if (existingCode.used) {
      return NextResponse.json(
        { error: 'Cannot edit a discount code that has already been used' },
        { status: 400 }
      );
    }

    // Calculate new expiration date from date string or legacy days
    let newExpiresAt = existingCode.expires_at;
    if (expiresOn !== undefined && expiresOn !== null) {
      if (expiresOn && typeof expiresOn === 'string' && expiresOn.trim()) {
        // New format: date string (YYYY-MM-DD) - set to end of day (23:59:59)
        const date = new Date(expiresOn);
        date.setHours(23, 59, 59, 999); // End of day
        newExpiresAt = date.toISOString();
      } else {
        // Empty string means no expiry
        newExpiresAt = null;
      }
    } else if (expiresInDays !== undefined && expiresInDays !== null) {
      // Legacy support: days from now
      if (expiresInDays > 0) {
        newExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        newExpiresAt = null;
      }
    }

    // No Stripe coupon updates needed (removed Stripe dependency)
      
      try {
        // Create new coupon FIRST (before deleting old one to avoid orphaned state)
        const couponName = `One-time: ${existingCode.code}`;
        let coupon: Stripe.Coupon;
        if (discountType === 'percent') {
          const couponParams: Stripe.CouponCreateParams = {
            name: couponName,
            duration: 'once',
            percent_off: Math.round(discountValue),
            metadata: {
              one_time_code: existingCode.code,
              discount_type: discountType,
            },
          };
          if (discountCap) {
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
            amount_off: Math.round(discountValue * 100),
            currency: 'usd',
            metadata: {
              one_time_code: existingCode.code,
              discount_type: discountType,
            },
          });
        }
        
        newCouponId = String(coupon.id).trim();
        if (!newCouponId || newCouponId.length === 0) {
          throw new Error('Invalid coupon ID returned from Stripe');
        }
        
        // Update database with new coupon ID
        await sql`
          UPDATE discount_codes
          SET 
            discount_type = ${discountType},
            discount_value = ${discountValue},
            discount_cap = ${discountCap || null},
            expires_at = ${newExpiresAt},
            stripe_coupon_id = ${newCouponId},
            updated_at = NOW()
          WHERE id = ${codeId} AND code_type = 'one_time'
        `;
        
        // Only delete old coupon after DB update succeeds
        try {
          await stripe.coupons.del(oldCouponId);
          console.log('[Update Discount Code] Successfully replaced old coupon:', oldCouponId);
        } catch (delError: any) {
          // Log but don't fail - old coupon might already be deleted
          console.warn('[Update Discount Code] Failed to delete old coupon (non-critical):', delError.message);
        }
      } catch (stripeError: any) {
        console.error('[Update Discount Code] Stripe coupon update failed:', {
          error: stripeError.message,
          code: stripeError.code,
          type: stripeError.type,
        });
        
        // If new coupon was created but DB update failed, clean it up
        if (newCouponId) {
          try {
            await stripe.coupons.del(newCouponId);
            console.log('[Update Discount Code] Cleaned up orphaned new coupon:', newCouponId);
          } catch (cleanupError) {
            console.error('[Update Discount Code] Failed to clean up orphaned coupon:', cleanupError);
          }
        }
        
        return NextResponse.json(
          { error: 'Failed to update Stripe coupon', details: stripeError.message },
          { status: 500 }
        );
      }
    } else {
      // Just update database fields
      await sql`
        UPDATE discount_codes
        SET 
          discount_type = ${discountType},
          discount_value = ${discountValue},
          discount_cap = ${discountCap || null},
          expires_at = ${newExpiresAt},
          updated_at = NOW()
        WHERE id = ${codeId} AND code_type = 'one_time'
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Update Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/discount-codes/[id] - Mark discount code as inactive (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const sql = getSqlClient();

    // Fetch existing code (one-time codes only)
    const codeResult = await sql`
      SELECT id, code, used, is_active
      FROM discount_codes
      WHERE id = ${codeId} AND code_type = 'one_time'
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const existingCode = codeRows[0];

    // Check if already inactive
    if (existingCode.is_active === false) {
      return NextResponse.json({ error: 'Code is already inactive' }, { status: 400 });
    }

    // Mark as inactive (soft delete) - keep record for history
    await sql`
      UPDATE discount_codes
      SET is_active = false, updated_at = NOW()
      WHERE id = ${codeId} AND code_type = 'one_time'
    `;

    console.log(`[Delete Discount Code] Successfully marked code ${existingCode.code} as inactive (ID: ${codeId})`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Delete Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

