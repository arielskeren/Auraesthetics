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

// GET /api/admin/discount-codes/[id]/usage - Get usage details for a discount code
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const codeId = params.id;

    // Get the code to find the code string (one-time codes only)
    const codeResult = await sql`
      SELECT code FROM discount_codes WHERE id = ${codeId} AND code_type = 'one_time' LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }
    const codeString = codeRows[0].code;

    // Find booking that used this code
    const usageResult = await sql`
      SELECT 
        b.id AS booking_id,
        b.service_name,
        b.booking_date,
        b.client_email,
        b.client_name,
        be.created_at AS used_at
      FROM booking_events be
      JOIN bookings b ON be.booking_id = b.id
      WHERE be.type = 'finalized'
        AND (be.data->>'discountCode' = ${codeString.toUpperCase()}
          OR be.data->>'discount_code' = ${codeString.toUpperCase()})
      ORDER BY be.created_at DESC
      LIMIT 1
    `;
    const usage = normalizeRows(usageResult)[0];

    if (!usage) {
      return NextResponse.json({ usage: null });
    }

    return NextResponse.json({ usage });
  } catch (error: any) {
    console.error('[Discount Code Usage API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage details', details: error.message },
      { status: 500 }
    );
  }
}

