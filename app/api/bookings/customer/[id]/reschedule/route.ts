import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { updateBooking } from '@/lib/hapioClient';
import { ensureOutlookEventForBooking } from '@/lib/outlookBookingSync';
import { sendBrevoEmail } from '@/lib/brevoClient';
import { generateBookingRescheduleEmail } from '@/lib/emails/bookingReschedule';

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

// POST /api/bookings/customer/[id]/reschedule - Customer-facing reschedule
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id;
    const body = await request.json();
    const { newDate, newTime } = body;

    if (!newDate || !newTime) {
      return NextResponse.json(
        { error: 'New date and time are required' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    // Parse new date/time
    const newDateTime = new Date(`${newDate}T${newTime}`);
    if (isNaN(newDateTime.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date or time format' },
        { status: 400 }
      );
    }

    // Validate date is in the future
    if (newDateTime <= new Date()) {
      return NextResponse.json(
        { error: 'New date and time must be in the future' },
        { status: 400 }
      );
    }

    // Fetch booking
    const bookingResult = await sql`
      SELECT 
        id, hapio_booking_id, service_id, service_name, booking_date, metadata, client_email, client_name, payment_status, outlook_event_id
      FROM bookings
      WHERE id = ${bookingId} OR hapio_booking_id = ${bookingId}
      LIMIT 1
    `;
    const bookingRows = normalizeRows(bookingResult);
    if (bookingRows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    const bookingData = bookingRows[0];

    if (!bookingData.hapio_booking_id) {
      return NextResponse.json(
        { error: 'Booking does not have a Hapio booking ID' },
        { status: 400 }
      );
    }

    // Validate booking can be rescheduled
    if (bookingData.payment_status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot reschedule a cancelled booking' },
        { status: 400 }
      );
    }

    // Check if booking is within 72 hours (cannot reschedule within 72 hours)
    if (bookingData.booking_date) {
      const bookingDateTime = new Date(bookingData.booking_date);
      const now = new Date();
      const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilBooking <= 72) {
        return NextResponse.json(
          { 
            error: 'Rescheduling must be done at least 72 hours before the appointment. Please call or text +1 (440) 520-3337 to change your appointment.',
            hoursUntilBooking: Math.round(hoursUntilBooking * 10) / 10,
          },
          { status: 400 }
        );
      }
    }

    // Calculate end time (need service duration)
    let durationMinutes = 60; // Default
    if (bookingData.service_id) {
      const serviceResult = await sql`
        SELECT duration_minutes FROM services
        WHERE id = ${bookingData.service_id} OR slug = ${bookingData.service_id}
        LIMIT 1
      `;
      const serviceRows = normalizeRows(serviceResult);
      if (serviceRows.length > 0 && serviceRows[0].duration_minutes) {
        durationMinutes = Number(serviceRows[0].duration_minutes);
      }
    }

    const newEndDateTime = new Date(newDateTime);
    newEndDateTime.setMinutes(newEndDateTime.getMinutes() + durationMinutes);

    // Wrap in transaction
    await sql`BEGIN`;
    try {
      // Update Hapio booking
      // Format dates in Hapio's required format: Y-m-d\TH:i:sP (e.g., 2025-11-18T14:30:00-05:00)
      const { formatDateForHapio } = await import('@/lib/hapioDateUtils');
      try {
        await updateBooking(bookingData.hapio_booking_id, {
          startsAt: formatDateForHapio(newDateTime),
          endsAt: formatDateForHapio(newEndDateTime),
          // Allow rescheduling even if schedule check would normally fail
          // The user has already selected from available slots, so we trust their selection
          ignoreSchedule: true,
        });
      } catch (hapioError: any) {
        await sql`ROLLBACK`;
        
        // Provide more helpful error messages
        let errorMessage = hapioError?.message || String(hapioError);
        if (errorMessage.includes('open schedule') || errorMessage.includes('does not have an open schedule')) {
          errorMessage = 'The selected time slot is not available. The resource does not have an open schedule for this time. Please select a different time slot.';
        }
        
        return NextResponse.json(
          { error: `Failed to update booking in Hapio: ${errorMessage}` },
          { status: 500 }
        );
      }

      // Update Neon booking
      await sql`
        UPDATE bookings
        SET 
          booking_date = ${newDateTime.toISOString()},
          updated_at = NOW(),
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{rescheduled_at}',
            ${JSON.stringify(new Date().toISOString())}::jsonb
          )
        WHERE id = ${bookingData.id}
      `;

      await sql`COMMIT`;

      // Update Outlook event if it exists (best-effort)
      // Fetch outlook_event_id from bookings table if not in metadata
      let outlookEventId = bookingData.metadata?.outlook?.eventId;
      if (!outlookEventId) {
        const outlookResult = await sql`
          SELECT outlook_event_id FROM bookings WHERE id = ${bookingData.id} LIMIT 1
        `;
        const outlookRows = normalizeRows(outlookResult);
        if (outlookRows.length > 0 && outlookRows[0].outlook_event_id) {
          outlookEventId = outlookRows[0].outlook_event_id;
        }
      }

      if (process.env.OUTLOOK_SYNC_ENABLED !== 'false' && outlookEventId) {
        try {
          await ensureOutlookEventForBooking({
            id: bookingData.id,
            service_id: bookingData.service_id, // Can be UUID or slug, Outlook sync handles both
            service_name: bookingData.service_name,
            client_name: bookingData.client_name || null,
            client_email: bookingData.client_email || null,
            booking_date: newDateTime.toISOString(),
            outlook_event_id: outlookEventId,
            metadata: {
              ...(bookingData.metadata || {}),
              slot: {
                start: newDateTime.toISOString(),
                end: newEndDateTime.toISOString(),
                timezone: 'America/New_York',
              },
            },
          });
        } catch (outlookError) {
          console.error('[Customer Reschedule] Outlook update failed:', outlookError);
        }
      }

      // Send reschedule email to customer
      if (bookingData.client_email) {
        try {
          // Fetch service details for email
          let serviceImageUrl: string | null = null;
          if (bookingData.service_id) {
            try {
              const serviceResult = await sql`
                SELECT image_url FROM services
                WHERE id = ${bookingData.service_id} OR slug = ${bookingData.service_id}
                LIMIT 1
              `;
              const serviceRows = normalizeRows(serviceResult);
              if (serviceRows.length > 0) {
                serviceImageUrl = serviceRows[0].image_url || null;
              }
            } catch (e) {
              // Non-critical
            }
          }

          // Format dates and times
          const oldBookingDate = bookingData.booking_date ? new Date(bookingData.booking_date) : new Date();
          const oldBookingTime = oldBookingDate.toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          const newBookingTime = newDateTime.toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          // Generate reschedule email
          const emailHtml = generateBookingRescheduleEmail({
            serviceName: bookingData.service_name || 'Service',
            serviceImageUrl,
            clientName: bookingData.client_name || null,
            oldBookingDate,
            oldBookingTime,
            newBookingDate: newDateTime,
            newBookingTime,
          });

          await sendBrevoEmail({
            to: [{ email: bookingData.client_email, name: bookingData.client_name || undefined }],
            subject: `Your ${bookingData.service_name || 'appointment'} has been rescheduled`,
            htmlContent: emailHtml,
            tags: ['booking_rescheduled'],
          });
        } catch (emailError) {
          console.error('[Customer Reschedule] Email send failed:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Booking rescheduled successfully',
        booking: {
          ...bookingData,
          booking_date: newDateTime.toISOString(),
        },
      });
    } catch (error: any) {
      try {
        await sql`ROLLBACK`;
      } catch (rollbackError) {
        console.error('[Customer Reschedule] Rollback failed:', rollbackError);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('[Customer Reschedule] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reschedule booking', details: error?.message },
      { status: 500 }
    );
  }
}

