import { NextRequest, NextResponse } from 'next/server';
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

/**
 * Normalizes PostgreSQL boolean values to determine if a code is active.
 * Handles: true (boolean), 't' (string), false (boolean), 'f' (string), null (treated as active)
 */
function isCodeActive(code: any): boolean {
  // Handle PostgreSQL boolean types: true, 't', false, 'f', null
  if (code.is_active === false || code.is_active === 'f') {
    return false;
  }
  // null, true, 't', or undefined should be treated as active
  return true;
}

export const dynamic = 'force-dynamic';

// GET /api/admin/discount-codes - List all discount codes with usage info
export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();

    const now = new Date();

    // Fetch all one-time discount codes with customer info
    // Handle both explicit 'one_time' codes and legacy codes (NULL code_type with customer_id)
    const codesResult = await sql`
      SELECT 
        dc.id,
        dc.code,
        dc.code_type,
        dc.customer_id,
        dc.discount_type,
        dc.discount_value,
        dc.discount_cap,
        dc.used,
        dc.used_at,
        dc.expires_at,
        dc.is_active,
        dc.created_at,
        dc.created_by,
        c.email AS customer_email,
        TRIM(COALESCE(c.first_name || ' ', '') || COALESCE(c.last_name, '')) AS customer_name
      FROM discount_codes dc
      LEFT JOIN customers c ON dc.customer_id = c.id
      WHERE (dc.code_type = 'one_time' OR (dc.code_type IS NULL AND dc.customer_id IS NOT NULL))
      ORDER BY dc.created_at DESC
    `;
    const allCodes = normalizeRows(codesResult);
    
    // Debug logging - only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Discount Codes API] Total codes fetched:', allCodes.length);
      if (allCodes.length > 0) {
        console.log('[Discount Codes API] Sample codes:', allCodes.slice(0, 5).map((c: any) => ({
          code: c.code,
          code_type: c.code_type,
          is_active: c.is_active,
          is_active_type: typeof c.is_active,
          used: c.used,
          expires_at: c.expires_at,
          customer_id: c.customer_id ? 'has customer' : 'no customer'
        })));
      }
    }

    // For used codes, fetch booking usage details
    const codesWithUsage = await Promise.all(
      allCodes.map(async (code: any) => {
        if (!code.used || !code.used_at) {
          return code;
        }

        // Find booking that used this code
        try {
          let usageResult = await sql`
            SELECT 
              b.id AS booking_id,
              b.service_name AS booking_service,
              b.booking_date,
              b.client_email,
              b.client_name,
              be.created_at AS used_at
            FROM booking_events be
            JOIN bookings b ON be.booking_id = b.id
            WHERE be.type = 'finalized'
              AND (be.data->>'discountCode' = ${code.code.toUpperCase()}
                OR b.metadata->>'discountCode' = ${code.code.toUpperCase()})
            ORDER BY be.created_at DESC
            LIMIT 1
          `;
          
          if (normalizeRows(usageResult).length === 0) {
            usageResult = await sql`
              SELECT 
                b.id AS booking_id,
                b.service_name AS booking_service,
                b.booking_date,
                b.client_email,
                b.client_name,
                b.created_at AS used_at
              FROM bookings b
              WHERE b.metadata->>'discountCode' = ${code.code.toUpperCase()}
              ORDER BY b.created_at DESC
              LIMIT 1
            `;
          }
          const usage = normalizeRows(usageResult)[0];
          if (usage) {
            return {
              ...code,
              booking_id: usage.booking_id,
              booking_service: usage.booking_service,
              booking_date: usage.booking_date,
            };
          }
        } catch (e) {
          // Non-critical
        }

        return code;
      })
    );

    // Group codes by status
    const active: any[] = [];
    const used: any[] = [];
    const inactive: any[] = [];

    codesWithUsage.forEach((code: any) => {
      // Use PostgreSQL NOW() comparison for consistency with database queries
      // Convert expires_at to Date and compare with current time
      const expiresAtDate = code.expires_at ? new Date(code.expires_at) : null;
      const isExpired = expiresAtDate && expiresAtDate <= now;
      
      // Use helper function to normalize boolean values
      const isInactive = !isCodeActive(code);
      
      // Handle used: explicitly true means used (handles both boolean true and string 't')
      const isUsed = code.used === true || code.used === 't';

      // Log each code's evaluation for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Code ${code.code}]`, {
          id: code.id,
          is_active: code.is_active,
          is_active_type: typeof code.is_active,
          isCodeActive: isCodeActive(code),
          isInactive,
          isUsed,
          isExpired,
          expires_at: code.expires_at,
          expiresAtDate: expiresAtDate?.toISOString(),
          now: now.toISOString(),
          finalStatus: isUsed ? 'used' : (isInactive || isExpired ? 'inactive' : 'active')
        });
      }

      if (isUsed) {
        used.push(code);
      } else if (isInactive || isExpired) {
        inactive.push(code);
      } else {
        // Active codes: not used, not inactive (is_active is true, 't', or NULL), not expired
        active.push(code);
      }
    });
    
    // Debug logging - only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Discount Codes API] Grouped codes:', {
        active: active.length,
        used: used.length,
        inactive: inactive.length,
        total: allCodes.length
      });
      // Log codes with is_active = false to verify they're being filtered correctly
      const inactiveCodes = allCodes.filter((c: any) => c.is_active === false || c.is_active === 'f');
      if (inactiveCodes.length > 0) {
        console.log('[Discount Codes API] Codes with is_active=false:', inactiveCodes.map((c: any) => ({
          code: c.code,
          is_active: c.is_active,
          is_active_type: typeof c.is_active
        })));
      }
    }

    return NextResponse.json({ 
      active,
      used,
      inactive,
    });
  } catch (error: any) {
    console.error('[Discount Codes API] Error:', error);
    console.error('[Discount Codes API] Error stack:', error?.stack);
    console.error('[Discount Codes API] Error details:', {
      message: error?.message,
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch discount codes', 
        details: error.message,
        errorType: error?.name || 'UnknownError',
      },
      { status: 500 }
    );
  }
}

