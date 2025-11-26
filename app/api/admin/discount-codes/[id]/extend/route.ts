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

// POST /api/admin/discount-codes/[id]/extend - Extend expiry date
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const codeId = params.id;
    const body = await request.json();
    const { days } = body;

    if (!days || typeof days !== 'number' || days <= 0) {
      return NextResponse.json(
        { error: 'Valid number of days is required' },
        { status: 400 }
      );
    }

    // Get current code (one-time codes only)
    const codeResult = await sql`
      SELECT expires_at, stripe_coupon_id, used
      FROM discount_codes
      WHERE id = ${codeId} AND code_type = 'one_time'
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const code = codeRows[0];
    if (code.used) {
      return NextResponse.json(
        { error: 'Cannot extend expiry for a used code' },
        { status: 400 }
      );
    }

    // Calculate new expiry date
    const currentExpiry = code.expires_at ? new Date(code.expires_at) : new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + days);

    // Update database
    await sql`
      UPDATE discount_codes
      SET expires_at = ${newExpiry.toISOString()}, updated_at = NOW()
      WHERE id = ${codeId} AND code_type = 'one_time'
    `;

    // Expiry is enforced at the application level (database)

    return NextResponse.json({
      success: true,
      message: `Expiry extended by ${days} days`,
      newExpiry: newExpiry.toISOString(),
    });
  } catch (error: any) {
    console.error('[Extend Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Failed to extend expiry', details: error.message },
      { status: 500 }
    );
  }
}

