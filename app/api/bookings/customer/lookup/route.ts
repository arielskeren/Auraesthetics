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

// GET /api/bookings/customer/lookup - Customer-facing booking lookup
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const lastName = searchParams.get('lastName');
    const email = searchParams.get('email');

    const sql = getSqlClient();

    let booking: any = null;

    // Mode 1: Direct ID lookup
    if (id) {
      const result = await sql`
        SELECT 
          b.id,
          b.hapio_booking_id,
          b.service_id,
          b.service_name,
          b.client_name,
          b.client_email,
          b.client_phone,
          b.booking_date,
          b.payment_status,
          b.payment_intent_id,
          b.metadata,
          s.name AS service_display_name,
          s.image_url AS service_image_url,
          s.duration_display AS service_duration,
          (
            SELECT SUM(amount_cents) 
            FROM payments 
            WHERE booking_id = b.id
          ) AS payment_amount_cents,
          (
            SELECT SUM(refunded_cents) 
            FROM payments 
            WHERE booking_id = b.id
          ) AS refunded_cents
        FROM bookings b
        LEFT JOIN services s ON (b.service_id = s.id::text OR b.service_id = s.slug)
        WHERE b.id = ${id} OR b.hapio_booking_id = ${id}
        LIMIT 1
      `;
      const rows = normalizeRows(result);
      if (rows.length > 0) {
        booking = rows[0];
      }
    }
    // Mode 2: Search by lastName + email (returns most recent booking)
    else if (lastName && email) {
      const lastNameLower = lastName.toLowerCase().trim();
      const emailLower = email.toLowerCase().trim();
      
      const result = await sql`
        SELECT 
          b.id,
          b.hapio_booking_id,
          b.service_id,
          b.service_name,
          b.client_name,
          b.client_email,
          b.client_phone,
          b.booking_date,
          b.payment_status,
          b.payment_intent_id,
          b.metadata,
          s.name AS service_display_name,
          s.image_url AS service_image_url,
          s.duration_display AS service_duration,
          (
            SELECT SUM(amount_cents) 
            FROM payments 
            WHERE booking_id = b.id
          ) AS payment_amount_cents,
          (
            SELECT SUM(refunded_cents) 
            FROM payments 
            WHERE booking_id = b.id
          ) AS refunded_cents
        FROM bookings b
        LEFT JOIN services s ON (b.service_id = s.id::text OR b.service_id = s.slug)
        WHERE LOWER(b.client_email) = ${emailLower}
          AND (
            LOWER(SPLIT_PART(b.client_name, ' ', -1)) = ${lastNameLower}
            OR LOWER(b.client_name) LIKE ${`%${lastNameLower}%`}
          )
        ORDER BY b.booking_date DESC, b.created_at DESC
        LIMIT 1
      `;
      const rows = normalizeRows(result);
      if (rows.length > 0) {
        booking = rows[0];
      }
    } else {
      return NextResponse.json(
        { error: 'Missing required parameters. Provide either "id" or both "lastName" and "email"' },
        { status: 400 }
      );
    }

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found. Please check your information and try again.' },
        { status: 404 }
      );
    }

    // Extract cancellation date from metadata
    const metadata = booking.metadata || {};
    const cancelledAt = metadata.cancelledAt || null;

    // Return booking without sensitive information
    return NextResponse.json({
      booking: {
        id: booking.id,
        hapio_booking_id: booking.hapio_booking_id,
        service_id: booking.service_id,
        service_name: booking.service_name,
        service_display_name: booking.service_display_name,
        service_image_url: booking.service_image_url,
        service_duration: booking.service_duration,
        client_name: booking.client_name,
        client_email: booking.client_email,
        client_phone: booking.client_phone,
        booking_date: booking.booking_date,
        payment_status: booking.payment_status,
        payment_amount_cents: booking.payment_amount_cents ? Number(booking.payment_amount_cents) : null,
        refunded_cents: booking.refunded_cents ? Number(booking.refunded_cents) : null,
        cancelled_at: cancelledAt,
        created_at: booking.created_at,
      },
    });
  } catch (error: any) {
    console.error('[Customer Booking Lookup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup booking', details: error.message },
      { status: 500 }
    );
  }
}

