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
      const isExpired = code.expires_at && new Date(code.expires_at) <= now;
      // Handle is_active: explicitly false means inactive, NULL/true means active (default)
      // PostgreSQL booleans can be true/false/null, ensure we check correctly
      // Check for false explicitly (handles both boolean false and string 'f' from PostgreSQL)
      const isInactive = code.is_active === false || code.is_active === 'f';
      // Handle used: explicitly true means used
      const isUsed = code.used === true || code.used === 't';

      if (isUsed) {
        used.push(code);
      } else if (isInactive || isExpired) {
        inactive.push(code);
      } else {
        // Active codes: not used, not inactive (is_active is true or NULL), not expired
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

