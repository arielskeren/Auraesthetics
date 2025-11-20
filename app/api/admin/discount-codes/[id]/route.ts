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

// PATCH /api/admin/discount-codes/[id] - Update discount code
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const body = await request.json();
    const { discountType, discountValue, discountCap, expiresInDays } = body;

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

    // Fetch existing code
    const codeResult = await sql`
      SELECT id, code, discount_type, discount_value, discount_cap, stripe_coupon_id, used, expires_at
      FROM one_time_discount_codes
      WHERE id = ${codeId}
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

    // Calculate new expiration date
    let newExpiresAt = existingCode.expires_at;
    if (expiresInDays !== undefined && expiresInDays !== null) {
      if (expiresInDays > 0) {
        newExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        newExpiresAt = null;
      }
    }

    // Update Stripe coupon if discount value or type changed
    if (existingCode.stripe_coupon_id && 
        (existingCode.discount_type !== discountType || 
         Number(existingCode.discount_value) !== discountValue)) {
      try {
        // Delete old coupon
        await stripe.coupons.del(existingCode.stripe_coupon_id);
        
        // Create new coupon
        const couponName = `One-time: ${existingCode.code}`;
        let coupon;
        if (discountType === 'percent') {
          const couponParams: any = {
            name: couponName,
            duration: 'once',
            percent_off: Math.round(discountValue),
            metadata: {
              one_time_code: existingCode.code,
              discount_type: discountType,
            },
          };
          if (discountCap) {
            couponParams.metadata.discount_cap = String(discountCap);
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

        // Update database with new coupon ID
        await sql`
          UPDATE one_time_discount_codes
          SET 
            discount_type = ${discountType},
            discount_value = ${discountValue},
            discount_cap = ${discountCap || null},
            expires_at = ${newExpiresAt},
            stripe_coupon_id = ${coupon.id},
            updated_at = NOW()
          WHERE id = ${codeId}
        `;
      } catch (stripeError: any) {
        console.error('[Update Discount Code] Stripe coupon update failed:', stripeError);
        return NextResponse.json(
          { error: 'Failed to update Stripe coupon', details: stripeError.message },
          { status: 500 }
        );
      }
    } else {
      // Just update database fields
      await sql`
        UPDATE one_time_discount_codes
        SET 
          discount_type = ${discountType},
          discount_value = ${discountValue},
          discount_cap = ${discountCap || null},
          expires_at = ${newExpiresAt},
          updated_at = NOW()
        WHERE id = ${codeId}
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

// DELETE /api/admin/discount-codes/[id] - Delete discount code
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const sql = getSqlClient();

    // Fetch existing code
    const codeResult = await sql`
      SELECT id, code, stripe_coupon_id, used
      FROM one_time_discount_codes
      WHERE id = ${codeId}
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const existingCode = codeRows[0];

    // Delete Stripe coupon if it exists
    if (existingCode.stripe_coupon_id) {
      try {
        await stripe.coupons.del(existingCode.stripe_coupon_id);
      } catch (stripeError: any) {
        // Log but don't fail - coupon might already be deleted
        console.warn('[Delete Discount Code] Stripe coupon deletion failed (may already be deleted):', stripeError);
      }
    }

    // Delete from database
    await sql`
      DELETE FROM one_time_discount_codes
      WHERE id = ${codeId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Delete Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

