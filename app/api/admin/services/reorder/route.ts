import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

/**
 * POST /api/admin/services/reorder
 * Update display_order for multiple services
 */
export async function POST(request: NextRequest) {
  try {
    const sql = getSqlClient();
    const body = await request.json();
    const { services } = body;

    if (!Array.isArray(services)) {
      return NextResponse.json(
        { error: 'services must be an array' },
        { status: 400 }
      );
    }

    // Update each service's display_order
    for (const service of services) {
      if (!service.id || service.display_order === undefined) {
        continue;
      }

      await sql`
        UPDATE services
        SET display_order = ${service.display_order}, updated_at = NOW()
        WHERE id = ${service.id}
      `;
    }

    return NextResponse.json({ success: true, message: 'Services reordered successfully' });
  } catch (error: any) {
    console.error('[Reorder Services API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reorder services',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

