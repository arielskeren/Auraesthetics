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

// POST /api/admin/discount-codes/[id]/lock - Lock or unlock a discount code
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const codeId = params.id;
    const body = await request.json();
    const { lock } = body;

    if (typeof lock !== 'boolean') {
      return NextResponse.json(
        { error: 'lock parameter must be a boolean' },
        { status: 400 }
      );
    }

    // Get current code (one-time codes only)
    const codeResult = await sql`
      SELECT used, expires_at
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
        { error: 'Cannot lock/unlock a used code' },
        { status: 400 }
      );
    }

    if (lock) {
      // Lock code by setting expiry to past date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await sql`
        UPDATE discount_codes
        SET expires_at = ${pastDate.toISOString()}, updated_at = NOW()
        WHERE id = ${codeId} AND code_type = 'one_time'
      `;
    } else {
      // Unlock code by removing expiry or setting to future
      // If code had an original expiry, we can't restore it, so set to 30 days from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await sql`
        UPDATE discount_codes
        SET expires_at = ${futureDate.toISOString()}, updated_at = NOW()
        WHERE id = ${codeId} AND code_type = 'one_time'
      `;
    }

    return NextResponse.json({
      success: true,
      message: lock ? 'Code locked successfully' : 'Code unlocked successfully',
    });
  } catch (error: any) {
    console.error('[Lock Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update code status', details: error.message },
      { status: 500 }
    );
  }
}

