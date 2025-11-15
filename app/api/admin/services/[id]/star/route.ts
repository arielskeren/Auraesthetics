import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

/**
 * POST /api/admin/services/[id]/star
 * Toggle starred status for a service (max 6 starred)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const { id } = params;
    const body = await request.json();
    const { starred } = body;

    if (typeof starred !== 'boolean') {
      return NextResponse.json(
        { error: 'starred must be a boolean' },
        { status: 400 }
      );
    }

    // If trying to star, check if we already have 6 starred services
    if (starred) {
      const starredCount = await sql`
        SELECT COUNT(*) as count FROM services WHERE starred = true
      ` as Array<{ count: number | string }>;
      
      const count = Number(starredCount[0]?.count || 0);
      if (count >= 6) {
        // Check if this service is already starred
        const current = await sql`
          SELECT starred FROM services WHERE id = ${id}
        ` as Array<{ starred: boolean }>;
        
        if (current.length === 0) {
          return NextResponse.json(
            { error: 'Service not found' },
            { status: 404 }
          );
        }
        
        if (!current[0].starred) {
          return NextResponse.json(
            { error: 'Maximum of 6 services can be starred' },
            { status: 400 }
          );
        }
      }
    }

    // Update starred status
    const result = await sql`
      UPDATE services
      SET starred = ${starred}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, starred
    ` as Array<{ id: string; starred: boolean }>;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, starred: result[0].starred });
  } catch (error: any) {
    console.error('[Star Service API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update starred status',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

