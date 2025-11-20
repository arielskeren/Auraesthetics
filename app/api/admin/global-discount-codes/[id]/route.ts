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

// PATCH /api/admin/global-discount-codes/[id] - Update global discount code
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const body = await request.json();
    const { discountType, discountValue, discountCap, maxUses, expiresInDays, isActive } = body;

    const sql = getSqlClient();

    // Fetch existing code
    const codeResult = await sql`
      SELECT id, code, discount_type, discount_value, discount_cap, stripe_coupon_id, stripe_promotion_code_id, max_uses, expires_at, is_active
      FROM discount_codes
      WHERE id = ${codeId}
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const existingCode = codeRows[0];

    // Calculate new expiration date
    let newExpiresAt = existingCode.expires_at;
    if (expiresInDays !== undefined && expiresInDays !== null) {
      if (expiresInDays > 0) {
        newExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        newExpiresAt = null;
      }
    }

    // Update Stripe coupon if needed
    if (existingCode.stripe_coupon_id) {
      try {
        // Note: Stripe doesn't allow updating coupons, so we need to create a new one
        // But we can update the promotion code
        if (existingCode.stripe_promotion_code_id && isActive !== undefined) {
          await stripe.promotionCodes.update(existingCode.stripe_promotion_code_id, {
            active: isActive,
          });
        }
      } catch (stripeError: any) {
        console.error('[Update Global Discount Code] Stripe update failed:', stripeError);
        // Continue with database update even if Stripe update fails
      }
    }

    // Update database
    await sql`
      UPDATE discount_codes
      SET 
        discount_type = ${discountType !== undefined ? discountType : existingCode.discount_type},
        discount_value = ${discountValue !== undefined ? discountValue : existingCode.discount_value},
        discount_cap = ${discountCap !== undefined ? (discountCap || null) : existingCode.discount_cap},
        max_uses = ${maxUses !== undefined ? (maxUses || null) : existingCode.max_uses},
        expires_at = ${newExpiresAt},
        is_active = ${isActive !== undefined ? isActive : existingCode.is_active},
        updated_at = NOW()
      WHERE id = ${codeId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Update Global Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/global-discount-codes/[id] - Delete global discount code
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const sql = getSqlClient();

    // Fetch existing code
    const codeResult = await sql`
      SELECT id, code, stripe_coupon_id, stripe_promotion_code_id
      FROM discount_codes
      WHERE id = ${codeId}
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const existingCode = codeRows[0];

    // Delete Stripe promotion code and coupon if they exist
    if (existingCode.stripe_promotion_code_id) {
      try {
        await stripe.promotionCodes.update(existingCode.stripe_promotion_code_id, {
          active: false,
        });
      } catch (stripeError: any) {
        console.warn('[Delete Global Discount Code] Stripe promotion code deactivation failed:', stripeError);
      }
    }

    if (existingCode.stripe_coupon_id) {
      try {
        await stripe.coupons.del(existingCode.stripe_coupon_id);
      } catch (stripeError: any) {
        console.warn('[Delete Global Discount Code] Stripe coupon deletion failed (may already be deleted):', stripeError);
      }
    }

    // Delete from database
    await sql`
      DELETE FROM discount_codes
      WHERE id = ${codeId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Delete Global Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

