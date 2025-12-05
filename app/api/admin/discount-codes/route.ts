import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { normalizeIsActive, isCodeActive, isCodeInactive } from '@/app/_utils/discountCodeUtils';

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

    // DIAGNOSTIC: Count all codes in the database to detect filtering issues
    const totalCountResult = await sql`
      SELECT COUNT(*) as total_count FROM discount_codes
    `;
    const totalInDb = normalizeRows(totalCountResult)[0]?.total_count || 0;
    
    const oneTimeCountResult = await sql`
      SELECT COUNT(*) as count FROM discount_codes 
      WHERE (code_type = 'one_time' OR (code_type IS NULL AND customer_id IS NOT NULL))
    `;
    const oneTimeCount = normalizeRows(oneTimeCountResult)[0]?.count || 0;
    
    // DIAGNOSTIC: Get all one-time code IDs to compare with actual query results
    const oneTimeIdsResult = await sql`
      SELECT id, code, code_type, customer_id, is_active 
      FROM discount_codes 
      WHERE (code_type = 'one_time' OR (code_type IS NULL AND customer_id IS NOT NULL))
      ORDER BY created_at DESC
    `;
    const allOneTimeIds = normalizeRows(oneTimeIdsResult);
    
    console.log('[Discount Codes API] DB Counts:', { totalInDb, oneTimeCount });
    console.log('[Discount Codes API] All one-time codes:', allOneTimeIds.map((c: any) => ({ id: c.id, code: c.code })));

    // Fetch all one-time discount codes WITHOUT JOIN (to avoid potential Neon driver issues)
    // Handle both explicit 'one_time' codes and legacy codes (NULL code_type with customer_id)
    const codesResult = await sql`
      SELECT 
        id,
        code,
        code_type,
        customer_id,
        discount_type,
        discount_value,
        discount_cap,
        used,
        used_at,
        expires_at,
        is_active,
        created_at,
        created_by
      FROM discount_codes
      WHERE (code_type = 'one_time' OR (code_type IS NULL AND customer_id IS NOT NULL))
      ORDER BY created_at DESC
    `;
    const rawCodes = normalizeRows(codesResult);
    
    // Fetch customer info separately to avoid JOIN issues
    const customerIds = Array.from(new Set(rawCodes.map((c: any) => c.customer_id).filter(Boolean)));
    let customerMap: Record<string, any> = {};
    
    if (customerIds.length > 0) {
      const customersResult = await sql`
        SELECT id, email, first_name, last_name
        FROM customers
        WHERE id = ANY(${customerIds})
      `;
      const customers = normalizeRows(customersResult);
      customerMap = customers.reduce((acc: any, c: any) => {
        acc[c.id] = c;
        return acc;
      }, {});
    }
    
    // Merge customer info into codes
    const allCodes = rawCodes.map((code: any) => {
      const customer = code.customer_id ? customerMap[code.customer_id] : null;
      return {
        ...code,
        customer_email: customer?.email || null,
        customer_name: customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : null,
      };
    });
    
    // Normalize is_active values immediately after fetching to ensure consistency
    // PostgreSQL can return booleans in various formats, so normalize them all to boolean
    // CRITICAL: NULL values are now treated as INACTIVE (not active) for data integrity
    const normalizedCodes = allCodes.map((code: any) => {
      const rawIsActive = code.is_active;
      const normalizedIsActive = normalizeIsActive(rawIsActive);
      
      // Log if normalization changed the value (especially NULL -> false)
      if (rawIsActive !== normalizedIsActive) {
        if (rawIsActive === null || rawIsActive === undefined) {
          console.warn(`[Discount Codes API] Normalized NULL is_active for code ${code.code} to INACTIVE (false)`);
        } else if (rawIsActive === false || rawIsActive === 'f' || rawIsActive === 'false') {
          console.warn(`[Discount Codes API] Normalized is_active for code ${code.code}: ${rawIsActive} (${typeof rawIsActive}) -> ${normalizedIsActive} (boolean)`);
        }
      }
      
      return {
        ...code,
        is_active: normalizedIsActive, // Replace with normalized boolean
        _original_is_active: rawIsActive, // Keep original for debugging
      };
    });
    
    // Debug logging - only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Discount Codes API] Total codes fetched:', normalizedCodes.length);
      if (normalizedCodes.length > 0) {
        console.log('[Discount Codes API] Sample codes:', normalizedCodes.slice(0, 5).map((c: any) => ({
          code: c.code,
          code_type: c.code_type,
          is_active: c.is_active,
          is_active_type: typeof c.is_active,
          original_is_active: c._original_is_active,
          used: c.used,
          expires_at: c.expires_at,
          customer_id: c.customer_id ? 'has customer' : 'no customer'
        })));
      }
    }

    // For used codes, fetch booking usage details
    const codesWithUsage = await Promise.all(
      normalizedCodes.map(async (code: any) => {
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
      // CRITICAL: Use utility function to check inactive status - handles all edge cases
      // This is the SINGLE SOURCE OF TRUTH for checking if a code is inactive
      const isInactive = isCodeInactive(code);
      const isUsed = code.used === true || code.used === 't';
      
      // DEBUG: Log ALL codes with is_active issues to track categorization
      const rawIsActive = code.is_active;
      const normalizedCheck = normalizeIsActive(rawIsActive);
      if (!normalizedCheck || rawIsActive === false || code._original_is_active === false) {
        console.log(`[CRITICAL DEBUG] Code ${code.code} (${code.id}) categorization:`, {
          raw_is_active: rawIsActive,
          raw_is_active_type: typeof rawIsActive,
          normalized_check: normalizedCheck,
          isCodeInactive_result: isInactive,
          original_is_active: code._original_is_active,
          isUsed,
          willGoTo: isInactive ? (isUsed ? 'used' : 'inactive') : 'ACTIVE (ERROR!)'
        });
      }
      
      // ABSOLUTE FIRST CHECK: If code is inactive, route it immediately
      // This MUST happen before any other categorization logic
      if (isInactive) {
        // Inactive codes go to inactive section UNLESS they're used
        // Used codes go to used section regardless of active status
        if (isUsed) {
          used.push(code);
          console.log(`[DEBUG] Code ${code.code} added to USED (was inactive but used)`);
        } else {
          inactive.push(code);
          console.log(`[DEBUG] Code ${code.code} added to INACTIVE`);
        }
        return; // CRITICAL: Skip ALL other logic for this code
      }
      
      // At this point, code is active (is_active === true)
      // Check expiration and usage status
      const expiresAtDate = code.expires_at ? new Date(code.expires_at) : null;
      const isExpired = expiresAtDate && expiresAtDate <= now;

      // Log each code's evaluation for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Code ${code.code}]`, {
          id: code.id,
          is_active: code.is_active,
          is_active_type: typeof code.is_active,
          original_is_active: code._original_is_active,
          isInactive,
          isUsed,
          isExpired,
          expires_at: code.expires_at,
          expiresAtDate: expiresAtDate?.toISOString(),
          now: now.toISOString(),
          finalStatus: isUsed ? 'used' : (isExpired ? 'inactive' : 'active')
        });
      }

      // Categorize active codes
      if (isUsed) {
        used.push(code);
      } else if (isExpired) {
        inactive.push(code);
      } else {
        // Active codes: is_active = true, not used, not expired
        // CRITICAL: Triple-check using utility function before adding to active
        // This catches any edge cases the first check might have missed
        if (isCodeInactive(code)) {
          console.error(`[CRITICAL ERROR] Code ${code.code} (${code.id}) has is_active=false but reached active section! Adding to inactive instead.`, {
            is_active: code.is_active,
            is_active_type: typeof code.is_active,
            original_is_active: code._original_is_active,
            isCodeInactive_check: isCodeInactive(code),
            isUsed,
            isExpired
          });
          inactive.push(code);
        } else {
          active.push(code);
        }
      }
    });
    
    // Clean up debug fields before sending response
    const cleanResponse = (codes: any[]) => {
      return codes.map(({ _original_is_active, ...code }) => code);
    };

    // Debug logging - only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Discount Codes API] Grouped codes:', {
        active: active.length,
        used: used.length,
        inactive: inactive.length,
        total: normalizedCodes.length
      });
      // Log codes with is_active = false to verify they're being filtered correctly
      const inactiveCodes = normalizedCodes.filter((c: any) => c.is_active === false);
      if (inactiveCodes.length > 0) {
        console.log('[Discount Codes API] Codes with is_active=false:', inactiveCodes.map((c: any) => ({
          code: c.code,
          id: c.id,
          is_active: c.is_active,
          is_active_type: typeof c.is_active,
          original_is_active: c._original_is_active
        })));
      }
    }

    // FINAL SAFETY CHECK: Remove any codes with is_active = false from active array
    // Use utility function to catch ALL edge cases (string "false", null, etc.)
    // This is a fail-safe in case any inactive codes slipped through
    const safeActive = active.filter((code: any) => {
      if (isCodeInactive(code)) {
        console.error(`[CRITICAL] Removing inactive code ${code.code} (${code.id}) from active array in final safety check!`, {
          is_active: code.is_active,
          is_active_type: typeof code.is_active,
          original_is_active: code._original_is_active,
          isCodeInactive_result: isCodeInactive(code)
        });
        inactive.push(code); // Move to inactive
        return false;
      }
      return true;
    });

    // Find codes that exist in simple query but not in main query
    const fetchedIds = new Set(normalizedCodes.map((c: any) => c.id));
    const missingFromMainQuery = allOneTimeIds.filter((c: any) => !fetchedIds.has(c.id));
    
    // Include diagnostic counts in response to help track missing codes
    const diagnostics = {
      totalCodesInDatabase: parseInt(totalInDb),
      totalOneTimeInDatabase: parseInt(oneTimeCount),
      totalFetchedFromQuery: normalizedCodes.length,
      totalCategorized: safeActive.length + used.length + inactive.length,
      activeCount: safeActive.length,
      usedCount: used.length,
      inactiveCount: inactive.length,
      // If any codes were lost in categorization, this will be non-zero
      missingCodes: normalizedCodes.length - (safeActive.length + used.length + inactive.length),
      // If query fetched fewer than expected
      queryMismatch: parseInt(oneTimeCount) - normalizedCodes.length,
      // Codes that exist but weren't returned by the main query
      missingFromMainQuery: missingFromMainQuery.map((c: any) => ({
        id: c.id,
        code: c.code,
        code_type: c.code_type,
        customer_id: c.customer_id,
        is_active: c.is_active,
      })),
    };
    
    // Log warning if codes were lost
    if (diagnostics.missingCodes > 0) {
      console.error('[CRITICAL] Some codes were lost during categorization!', diagnostics);
    }

    return NextResponse.json({ 
      active: cleanResponse(safeActive),
      used: cleanResponse(used),
      inactive: cleanResponse(inactive),
      _diagnostics: diagnostics,
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

