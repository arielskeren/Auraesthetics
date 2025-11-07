import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

// GET booking by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const sql = getSqlClient();

    const result = await sql`
      SELECT * FROM bookings 
      WHERE id = ${id}
    `;

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      booking: result[0],
    });
  } catch (error: any) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    );
  }
}

// UPDATE booking by ID
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const sql = getSqlClient();

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.paymentStatus) {
      updates.push(`payment_status = $${paramIndex}`);
      values.push(body.paymentStatus);
      paramIndex++;
    }
    if (body.paymentIntentId) {
      updates.push(`payment_intent_id = $${paramIndex}`);
      values.push(body.paymentIntentId);
      paramIndex++;
    }
    if (body.calBookingId) {
      updates.push(`cal_booking_id = $${paramIndex}`);
      values.push(body.calBookingId);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    // Use template literal for dynamic query
    const updateQuery = `
      UPDATE bookings 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    // Convert to template literal format for Neon
    const result = await sql`
      UPDATE bookings 
      SET 
        payment_status = ${body.paymentStatus || null},
        payment_intent_id = ${body.paymentIntentId || null},
        cal_booking_id = ${body.calBookingId || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: result[0],
    });
  } catch (error: any) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}

