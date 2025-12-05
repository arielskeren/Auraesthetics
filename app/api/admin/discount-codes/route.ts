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

// GET /api/admin/discount-codes - List all discount codes with usage info
export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();
    const now = new Date();

    // Use a single comprehensive query to get all one-time codes
    // This avoids connection pooling issues from multiple separate queries
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
        c.email as customer_email,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name
      FROM discount_codes dc
      LEFT JOIN customers c ON dc.customer_id = c.id
      WHERE (dc.code_type = 'one_time' OR (dc.code_type IS NULL AND dc.customer_id IS NOT NULL))
      ORDER BY dc.created_at DESC
    `;
    const rawCodes = normalizeRows(codesResult);
    
    // Get counts for diagnostics (single query)
    const countsResult = await sql`
      SELECT 
        (SELECT COUNT(*) FROM discount_codes) as total_count,
        (SELECT COUNT(*) FROM discount_codes WHERE code_type = 'one_time' OR (code_type IS NULL AND customer_id IS NOT NULL)) as one_time_count
    `;
    const counts = normalizeRows(countsResult)[0] || { total_count: 0, one_time_count: 0 };
    
    // Get all codes for diagnostics display
    const allCodesResult = await sql`
      SELECT id, code, code_type, customer_id, is_active, created_at
      FROM discount_codes
      ORDER BY created_at DESC
    `;
    const allCodesInDb = normalizeRows(allCodesResult);
    
    // Format codes with customer info
    const allCodes = rawCodes.map((code: any) => ({
      ...code,
      customer_email: code.customer_email || null,
      customer_name: code.customer_first_name || code.customer_last_name 
        ? `${code.customer_first_name || ''} ${code.customer_last_name || ''}`.trim() 
        : null,
    }));
    
    // Normalize is_active values
    const normalizedCodes = allCodes.map((code: any) => {
      const normalizedIsActive = normalizeIsActive(code.is_active);
      return {
        ...code,
        is_active: normalizedIsActive,
        _original_is_active: code.is_active,
      };
    });

    // For used codes, fetch booking usage details
    const codesWithUsage = await Promise.all(
      normalizedCodes.map(async (code: any) => {
        if (!code.used || !code.used_at) {
          return code;
        }

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
      const isInactive = isCodeInactive(code);
      const isUsed = code.used === true || code.used === 't';
      const expiresAtDate = code.expires_at ? new Date(code.expires_at) : null;
      const isExpired = expiresAtDate && expiresAtDate <= now;
      
      // Check for inactive status first
      if (isInactive) {
        if (isUsed) {
          used.push(code);
        } else {
          inactive.push(code);
        }
        return;
      }
      
      // Active codes
      if (isUsed) {
        used.push(code);
      } else if (isExpired) {
        inactive.push(code);
      } else {
        active.push(code);
      }
    });
    
    // Clean response
    const cleanResponse = (codes: any[]) => {
      return codes.map((code) => {
        const { _original_is_active, customer_first_name, customer_last_name, ...rest } = code;
        return rest;
      });
    };

    // Check for codes in allCodesInDb that should be one-time but aren't in our results
    const fetchedIds = new Set(normalizedCodes.map((c: any) => c.id));
    const missingCodes = allCodesInDb.filter((c: any) => {
      const isOneTimeCode = c.code_type === 'one_time' || (c.code_type === null && c.customer_id);
      return isOneTimeCode && !fetchedIds.has(c.id);
    });
    
    // Diagnostics
    const diagnostics = {
      totalCodesInDatabase: parseInt(counts.total_count),
      totalOneTimeInDatabase: parseInt(counts.one_time_count),
      totalFetchedFromQuery: normalizedCodes.length,
      totalCategorized: active.length + used.length + inactive.length,
      activeCount: active.length,
      usedCount: used.length,
      inactiveCount: inactive.length,
      missingCodes: missingCodes.length,
      queryMismatch: parseInt(counts.one_time_count) - normalizedCodes.length,
      allCodesInDatabase: allCodesInDb.map((c: any) => ({
        id: c.id,
        code: c.code,
        code_type: c.code_type,
        has_customer_id: !!c.customer_id,
        is_active: c.is_active,
        created_at: c.created_at,
      })),
      missingFromMainQuery: missingCodes.map((c: any) => ({
        id: c.id,
        code: c.code,
        code_type: c.code_type,
        is_active: c.is_active,
      })),
    };

    return NextResponse.json({ 
      active: cleanResponse(active),
      used: cleanResponse(used),
      inactive: cleanResponse(inactive),
      _diagnostics: diagnostics,
    });
  } catch (error: any) {
    console.error('[Discount Codes API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch discount codes', 
        details: error.message,
      },
      { status: 500 }
    );
  }
}
