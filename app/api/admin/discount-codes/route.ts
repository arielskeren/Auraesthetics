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

    // Auto-lock expired codes (set expiry to past if not already expired and not used)
    const now = new Date();
    await sql`
      UPDATE discount_codes
      SET expires_at = ${now.toISOString()}, updated_at = NOW()
      WHERE code_type = 'one_time'
        AND expires_at IS NOT NULL
        AND expires_at < ${now.toISOString()}
        AND used = false
    `;

    // Fetch all one-time discount codes with customer info
    const codesResult = await sql`
      SELECT 
        dc.id,
        dc.code,
        dc.customer_id,
        dc.discount_type,
        dc.discount_value,
        dc.discount_cap,
        dc.stripe_coupon_id,
        dc.used,
        dc.used_at,
        dc.expires_at,
        dc.created_at,
        dc.created_by,
        c.email AS customer_email,
        TRIM(COALESCE(c.first_name || ' ', '') || COALESCE(c.last_name, '')) AS customer_name
      FROM discount_codes dc
      LEFT JOIN customers c ON dc.customer_id = c.id
      WHERE dc.code_type = 'one_time'
        AND dc.stripe_coupon_id IS NOT NULL
      ORDER BY dc.created_at DESC
    `;
    const codes = normalizeRows(codesResult);
    
    // Filter out codes without stripe_coupon_id (basic validation)
    // These are likely phantom codes that were created but Stripe coupon creation failed
    const validCodesList = codes.filter((code: any) => {
      if (!code.stripe_coupon_id || code.stripe_coupon_id.trim() === '') {
        console.warn(`[Discount Codes API] Found code without Stripe coupon ID (phantom code): ${code.code} (ID: ${code.id})`);
        return false;
      }
      return true;
    });
    
    // Log if we filtered out any codes
    const filteredCount = codes.length - validCodesList.length;
    if (filteredCount > 0) {
      console.warn(`[Discount Codes API] Filtered out ${filteredCount} phantom codes (missing stripe_coupon_id) out of ${codes.length} total codes`);
    }
    
    // Note: We don't validate against Stripe API here to avoid blocking the request
    // A background job could be added to clean up orphaned Stripe coupons
    
    // Log for debugging
    console.log(`[Discount Codes API] Found ${codes.length} discount codes`);

    // For used codes, fetch booking usage details
    const codesWithUsage = await Promise.all(
      validCodesList.map(async (code) => {
        if (!code.used || !code.used_at) {
          return code;
        }

        // Find booking that used this code by checking payment intent metadata
        // We need to check booking_events or payments metadata for discount code
        try {
          // Check if we can find the booking via payment metadata
          // This is a simplified approach - in production you might want to store booking_id in one_time_discount_codes
          // Try multiple ways to find the booking that used this code
          // 1. Check booking_events data
          // 2. Check bookings metadata
          // 3. Check payments via payment intent metadata
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
          
          // If not found, try checking bookings metadata directly
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

    return NextResponse.json({ codes: codesWithUsage });
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

