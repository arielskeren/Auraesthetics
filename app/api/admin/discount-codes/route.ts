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

    // Check if table exists
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'one_time_discount_codes'
      LIMIT 1
    `;
    const hasTable = normalizeRows(tableCheck).length > 0;

    if (!hasTable) {
      return NextResponse.json({ codes: [] });
    }

    // Auto-lock expired codes (set expiry to past if not already expired and not used)
    const now = new Date();
    await sql`
      UPDATE one_time_discount_codes
      SET expires_at = ${now.toISOString()}, updated_at = NOW()
      WHERE expires_at IS NOT NULL
        AND expires_at < ${now.toISOString()}
        AND used = false
    `;

    // Fetch all discount codes with customer info
    const codesResult = await sql`
      SELECT 
        otc.id,
        otc.code,
        otc.customer_id,
        otc.discount_type,
        otc.discount_value,
        otc.stripe_coupon_id,
        otc.used,
        otc.used_at,
        otc.expires_at,
        otc.created_at,
        otc.created_by,
        c.email AS customer_email,
        TRIM(COALESCE(c.first_name || ' ', '') || COALESCE(c.last_name, '')) AS customer_name
      FROM one_time_discount_codes otc
      LEFT JOIN customers c ON otc.customer_id = c.id
      ORDER BY otc.created_at DESC
    `;
    const codes = normalizeRows(codesResult);

    // For used codes, fetch booking usage details
    const codesWithUsage = await Promise.all(
      codes.map(async (code) => {
        if (!code.used || !code.used_at) {
          return code;
        }

        // Find booking that used this code by checking payment intent metadata
        // We need to check booking_events or payments metadata for discount code
        try {
          // Check if we can find the booking via payment metadata
          // This is a simplified approach - in production you might want to store booking_id in one_time_discount_codes
          const usageResult = await sql`
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
              AND be.data->>'discountCode' = ${code.code.toUpperCase()}
            ORDER BY be.created_at DESC
            LIMIT 1
          `;
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
    return NextResponse.json(
      { error: 'Failed to fetch discount codes', details: error.message },
      { status: 500 }
    );
  }
}

