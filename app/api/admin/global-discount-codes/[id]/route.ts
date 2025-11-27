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

// PATCH /api/admin/global-discount-codes/[id] - Update global discount code
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const body = await request.json();
    const { discountType, discountValue, discountCap, maxUses, expiresOn, expiresInDays, isActive } = body;

    const sql = getSqlClient();

    // Fetch existing code
    const codeResult = await sql`
      SELECT id, code, discount_type, discount_value, discount_cap, max_uses, expires_at, is_active
      FROM discount_codes
      WHERE id = ${codeId}
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const existingCode = codeRows[0];

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

// DELETE /api/admin/global-discount-codes/[id] - Mark global discount code as inactive (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const sql = getSqlClient();

    // Fetch existing code
    const codeResult = await sql`
      SELECT id, code, is_active
      FROM discount_codes
      WHERE id = ${codeId}
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const existingCode = codeRows[0];

    // Check if already inactive using normalization utility for consistency
    // NULL values are treated as INACTIVE (not active)
    if (isCodeInactive(existingCode)) {
      console.log(`[Delete Global Discount Code] Code ${existingCode.code} (ID: ${codeId}) is already inactive`, {
        is_active: existingCode.is_active,
        is_active_type: typeof existingCode.is_active,
        normalized: normalizeIsActive(existingCode.is_active)
      });
      return NextResponse.json({ error: 'Code is already inactive' }, { status: 400 });
    }

    // Mark as inactive (soft delete) - keep record for history
    await sql`
      UPDATE discount_codes
      SET is_active = false, updated_at = NOW()
      WHERE id = ${codeId}
    `;

    console.log(`[Delete Global Discount Code] Successfully marked code ${existingCode.code} as inactive (ID: ${codeId})`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Delete Global Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

