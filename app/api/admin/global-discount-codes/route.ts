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

    const now = new Date();

    // Fetch all global discount codes with usage_count from database
    const codesResult = await sql`
      SELECT 
        id,
        code,
        COALESCE(discount_type, 'percent') as discount_type,
        discount_value,
        discount_cap,
        is_active,
        max_uses,
        expires_at,
        usage_count,
        created_at,
        updated_at
      FROM discount_codes
      WHERE code_type = 'global' OR code_type IS NULL
      ORDER BY created_at DESC
    `;
    const allCodes = normalizeRows(codesResult);

    // Group codes by status (only Active and Inactive for global codes)
    const active: any[] = [];
    const inactive: any[] = [];

    allCodes.forEach((code: any) => {
      // CRITICAL: Use normalization utility for consistent boolean handling
      // NULL values are treated as INACTIVE (not active)
      const isInactive = isCodeInactive(code);
      const isExpired = code.expires_at && new Date(code.expires_at) <= now;
      const usageCount = code.usage_count || 0;
      const maxUses = code.max_uses;
      
      // Check if max uses has been reached
      const maxUsesReached = maxUses !== null && maxUses !== undefined && usageCount >= maxUses;

      // Inactive if: explicitly inactive (including NULL), expired, or max uses reached
      if (isInactive || isExpired || maxUsesReached) {
        inactive.push({
          ...code,
          is_active: normalizeIsActive(code.is_active), // Normalize for consistency
          times_redeemed: usageCount,
        });
      } else {
        // Active: is_active = true, not expired, and (no max_uses or hasn't reached max_uses)
        active.push({
          ...code,
          is_active: normalizeIsActive(code.is_active), // Normalize for consistency
          times_redeemed: usageCount,
        });
      }
    });

    return NextResponse.json({ 
      activeCodes: active,
      inactiveCodes: inactive,
    });
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
      expiresOn, // Date string in YYYY-MM-DD format
      expiresInDays, // Legacy support - will be removed
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

    // Check if code already exists (any type)
    const existingCheck = await sql`
      SELECT id FROM discount_codes WHERE code = ${codeUpper} LIMIT 1
    `;
    if (normalizeRows(existingCheck).length > 0) {
      return NextResponse.json(
        { error: 'Discount code already exists' },
        { status: 400 }
      );
    }

    // Calculate expiration date from date string or legacy days
    let expiresAt = null;
    if (expiresOn && typeof expiresOn === 'string' && expiresOn.trim()) {
      // New format: date string (YYYY-MM-DD) - set to end of day (23:59:59)
      const date = new Date(expiresOn);
      date.setHours(23, 59, 59, 999); // End of day
      expiresAt = date.toISOString();
    } else if (expiresInDays && expiresInDays > 0) {
      // Legacy support: days from now
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    }

    // Insert into database (no Stripe dependency - all logic handled in application)
    try {
      await sql`
        INSERT INTO discount_codes (
          code,
          code_type,
          discount_type,
          discount_value,
          discount_cap,
          is_active,
          max_uses,
          expires_at,
          created_at,
          updated_at
        ) VALUES (
          ${codeUpper},
          'global',
          ${discountType},
          ${discountValue},
          ${discountCap || null},
          ${isActive},
          ${maxUses || null},
          ${expiresAt},
          NOW(),
          NOW()
        )
      `;
      console.log('[Create Global Discount Code] Successfully inserted into database:', codeUpper);
    } catch (dbError: any) {
      console.error('[Create Global Discount Code] Database insert failed:', dbError);
      
      return NextResponse.json(
        { 
          error: 'Failed to save discount code to database', 
          details: dbError.message,
        },
        { status: 500 }
      );
    }

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

