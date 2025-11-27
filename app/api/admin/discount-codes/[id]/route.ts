import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { normalizeIsActive, isCodeInactive } from '@/app/_utils/discountCodeUtils';

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

    // Update database fields (no Stripe dependency)
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Update Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Note: isCodeInactive is now imported from discountCodeUtils for consistency

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

    // Check if already inactive - use normalization utility for consistency
    // NULL values are treated as INACTIVE (not active)
    if (isCodeInactive(existingCode)) {
      console.log(`[Delete Discount Code] Code ${existingCode.code} (ID: ${codeId}) is already inactive`, {
        is_active: existingCode.is_active,
        is_active_type: typeof existingCode.is_active,
        normalized: normalizeIsActive(existingCode.is_active)
      });
      return NextResponse.json({ error: 'Code is already inactive' }, { status: 400 });
    }

    // Mark as inactive (soft delete) - keep record for history
    const updateResult = await sql`
      UPDATE discount_codes
      SET is_active = false, updated_at = NOW()
      WHERE id = ${codeId} AND code_type = 'one_time'
      RETURNING id, code, is_active
    `;

    const updatedRows = normalizeRows(updateResult);
    if (updatedRows.length === 0) {
      console.error(`[Delete Discount Code] UPDATE query returned no rows for code ID: ${codeId}`);
      return NextResponse.json(
        { error: 'Failed to update discount code' },
        { status: 500 }
      );
    }

    const updatedCode = updatedRows[0];
    
    // Verify the update actually set is_active to false using normalization utility
    if (!isCodeInactive(updatedCode)) {
      console.error(`[Delete Discount Code] UPDATE succeeded but is_active is not false for code ${updatedCode.code} (ID: ${codeId})`, {
        is_active: updatedCode.is_active,
        is_active_type: typeof updatedCode.is_active,
        normalized: normalizeIsActive(updatedCode.is_active)
      });
      return NextResponse.json(
        { error: 'Failed to properly deactivate discount code' },
        { status: 500 }
      );
    }

    console.log(`[Delete Discount Code] Successfully marked code ${existingCode.code} as inactive (ID: ${codeId})`, {
      before: {
        is_active: existingCode.is_active,
        is_active_type: typeof existingCode.is_active
      },
      after: {
        is_active: updatedCode.is_active,
        is_active_type: typeof updatedCode.is_active
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Delete Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

