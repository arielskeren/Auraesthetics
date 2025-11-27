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

/**
 * GET /api/admin/discount-codes/debug?code=CODE
 * Diagnostic endpoint to inspect raw database values for a specific discount code
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const codeId = searchParams.get('id');

    if (!code && !codeId) {
      return NextResponse.json(
        { error: 'Either code or id parameter is required' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    let codeResult;
    if (codeId) {
      codeResult = await sql`
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
          created_by,
          updated_at
        FROM discount_codes
        WHERE id = ${codeId}
        LIMIT 1
      `;
    } else {
      codeResult = await sql`
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
          created_by,
          updated_at
        FROM discount_codes
        WHERE code = ${code.toUpperCase()}
        LIMIT 1
      `;
    }

    const codeRows = normalizeRows(codeResult);
    
    if (codeRows.length === 0) {
      return NextResponse.json(
        { error: 'Discount code not found' },
        { status: 404 }
      );
    }

    const codeData = codeRows[0];

    // Get customer info if customer_id exists
    let customerInfo = null;
    if (codeData.customer_id) {
      try {
        const customerResult = await sql`
          SELECT id, email, first_name, last_name
          FROM customers
          WHERE id = ${codeData.customer_id}
          LIMIT 1
        `;
        const customerRows = normalizeRows(customerResult);
        if (customerRows.length > 0) {
          customerInfo = customerRows[0];
        }
      } catch (e) {
        // Non-critical
      }
    }

    // Calculate status evaluation
    const now = new Date();
    const expiresAtDate = codeData.expires_at ? new Date(codeData.expires_at) : null;
    const isExpired = expiresAtDate && expiresAtDate <= now;
    const isInactive = codeData.is_active === false || codeData.is_active === 'f';
    const isUsed = codeData.used === true || codeData.used === 't';
    
    // Determine expected status
    let expectedStatus = 'active';
    if (isUsed) {
      expectedStatus = 'used';
    } else if (isInactive || isExpired) {
      expectedStatus = 'inactive';
    }

    return NextResponse.json({
      success: true,
      code: {
        ...codeData,
        // Include type information for debugging
        _debug: {
          is_active: {
            value: codeData.is_active,
            type: typeof codeData.is_active,
            isBoolean: typeof codeData.is_active === 'boolean',
            isString: typeof codeData.is_active === 'string',
            isNull: codeData.is_active === null,
            isUndefined: codeData.is_active === undefined,
            normalized: codeData.is_active === false || codeData.is_active === 'f' ? false : true
          },
          used: {
            value: codeData.used,
            type: typeof codeData.used,
            isBoolean: typeof codeData.used === 'boolean',
            isString: typeof codeData.used === 'string',
            normalized: codeData.used === true || codeData.used === 't'
          },
          expires_at: {
            value: codeData.expires_at,
            type: typeof codeData.expires_at,
            isNull: codeData.expires_at === null,
            parsed: expiresAtDate?.toISOString() || null,
            now: now.toISOString(),
            isExpired
          },
          statusEvaluation: {
            isExpired,
            isInactive,
            isUsed,
            expectedStatus
          }
        },
        customer: customerInfo
      }
    });
  } catch (error: any) {
    console.error('[Discount Code Debug] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

