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

// GET /api/admin/discount-codes/verify - Verify which code IDs actually exist
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    
    if (!idsParam) {
      return NextResponse.json({ validIds: [] });
    }

    const ids = idsParam.split(',').filter(id => id.trim());
    if (ids.length === 0) {
      return NextResponse.json({ validIds: [] });
    }

    const sql = getSqlClient();

    // Check which IDs actually exist in the database
    const result = await sql`
      SELECT id FROM one_time_discount_codes
      WHERE id = ANY(${ids})
    `;
    
    const existingIds = normalizeRows(result).map((row: any) => row.id);
    
    return NextResponse.json({ validIds: existingIds });
  } catch (error: any) {
    console.error('[Verify Discount Codes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify codes', details: error.message },
      { status: 500 }
    );
  }
}

