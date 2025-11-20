import { createOutlookEvent, deleteOutlookEvent, updateOutlookEvent } from './outlookClient';
import { getServiceBySlug } from './serviceCatalog';
import { getSqlClient } from '@/app/_utils/db';

// Helper function to fetch complete booking data for Outlook sync
async function fetchBookingDataForOutlook(bookingId: string | number): Promise<BookingForOutlook | null> {
  const sql = getSqlClient();
  
  try {
    // Fetch booking with all related data (including phone from customers table)
    const bookingResult = await sql`
      SELECT 
        b.id,
        b.hapio_booking_id,
        b.service_id,
        b.service_name,
        b.client_name,
        b.client_email,
        b.client_phone,
        b.booking_date,
        b.created_at,
        b.payment_intent_id,
        b.customer_id,
        b.outlook_event_id,
        b.metadata,
        COALESCE(c.phone, b.client_phone) AS enriched_client_phone,
        COALESCE(p.amount_cents, 0) AS payment_amount_cents,
        COALESCE(p.refunded_cents, 0) AS refunded_cents
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN LATERAL (
        SELECT 
          SUM(amount_cents) AS amount_cents,
          SUM(refunded_cents) AS refunded_cents
        FROM payments
        WHERE booking_id = b.id
      ) p ON true
      WHERE b.id = ${String(bookingId)}
      LIMIT 1
    `;
    
    const bookings = Array.isArray(bookingResult) 
      ? bookingResult 
      : (bookingResult as any)?.rows || [];
    
    if (bookings.length === 0) {
      return null;
    }
    
    const booking = bookings[0];
    const metadata = booking.metadata || {};
    
    // Ensure slot information is in metadata for extractSlotInfo
    if (!metadata.slot && booking.booking_date) {
      metadata.slot = {
        start: booking.booking_date,
        end: null, // Will be computed by extractSlotInfo if needed
      };
    } else if (metadata.slot && !metadata.slot.start && booking.booking_date) {
      metadata.slot.start = booking.booking_date;
    }
    
    // Ensure timezone is in metadata
    if (!metadata.timezone) {
      metadata.timezone = 'America/New_York';
    }
    
    // Fetch refund information
    const refundResult = await sql`
      SELECT data, created_at
      FROM booking_events
      WHERE booking_id = ${String(bookingId)} AND type = 'refund'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const refundEvents = Array.isArray(refundResult) 
      ? refundResult 
      : (refundResult as any)?.rows || [];
    
    const refundEvent = refundEvents[0];
    const refundData = refundEvent?.data || {};
    
    // Fetch all booking events for change history
    const eventsResult = await sql`
      SELECT type, created_at, data
      FROM booking_events
      WHERE booking_id = ${String(bookingId)}
      ORDER BY created_at ASC
    `;
    const events = Array.isArray(eventsResult) 
      ? eventsResult 
      : (eventsResult as any)?.rows || [];
    
    // Extract discount information from metadata
    const discountCode = metadata.discountCode || metadata.discount_code || null;
    const discountAmountCents = metadata.discountAmountCents || metadata.discount_amount_cents || null;
    
    return {
      id: booking.id,
      service_id: booking.service_id,
      service_name: booking.service_name,
      client_name: booking.client_name,
      client_email: booking.client_email,
      client_phone: booking.enriched_client_phone || booking.client_phone || null,
      booking_date: booking.booking_date,
      outlook_event_id: booking.outlook_event_id,
      metadata: metadata,
      payment_intent_id: booking.payment_intent_id,
      payment_amount_cents: booking.payment_amount_cents ? Number(booking.payment_amount_cents) : null,
      discount_code: discountCode,
      discount_amount_cents: discountAmountCents ? Number(discountAmountCents) : null,
      refunded_cents: booking.refunded_cents ? Number(booking.refunded_cents) : null,
      refund_id: refundData.refundId || null,
      refund_reason: refundData.reason || null,
      refund_date: refundEvent?.created_at || null,
      customer_id: booking.customer_id,
      hapio_booking_id: booking.hapio_booking_id,
      created_at: booking.created_at,
      booking_events: events.map((e: any) => ({
        type: e.type,
        created_at: e.created_at,
        data: e.data,
      })),
    };
  } catch (error) {
    console.error('[Outlook Sync] Error fetching booking data:', error);
    return null;
  }
}

export interface BookingForOutlook {
  id: string | number;
  service_id: string | null;
  service_name: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone?: string | null;
  metadata?: any;
  booking_date?: string | null;
  outlook_event_id?: string | null;
  // Additional fields for enhanced event details
  payment_intent_id?: string | null;
  payment_amount_cents?: number | null;
  discount_code?: string | null;
  discount_amount_cents?: number | null;
  refunded_cents?: number | null;
  refund_id?: string | null;
  refund_reason?: string | null;
  refund_date?: string | null;
  customer_id?: string | null;
  hapio_booking_id?: string | null;
  created_at?: string | null; // Booked on date
  booking_events?: Array<{
    type: string;
    created_at: string;
    data?: any;
  }> | null;
}

interface SlotInfo {
  start: string;
  end: string;
  timeZone: string;
}

function parseDurationMinutes(duration?: string | null): number | null {
  if (!duration) return null;
  const match = duration.match(/(\d+)(?=\s*(min|minutes|m)\b)/i);
  if (match) {
    return Number(match[1]);
  }
  return null;
}

function computeFallbackEnd(startIso: string, serviceId: string | null): string {
  const startDate = new Date(startIso);
  const service = serviceId ? getServiceBySlug(serviceId) : null;
  const minutes = parseDurationMinutes(service?.duration) ?? 60;
  const endDate = new Date(startDate.getTime() + minutes * 60 * 1000);
  return endDate.toISOString();
}

/**
 * Convert a UTC ISO date string to EST ISO date string for Outlook
 * Outlook requires dates in the target timezone format
 * This function takes a UTC date and formats it as if it were in EST
 */
function convertToESTISO(dateString: string): string {
  const date = new Date(dateString);
  
  // Use Intl.DateTimeFormat to get EST time components
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = estFormatter.formatToParts(date);
  const estYear = parts.find(p => p.type === 'year')?.value;
  const estMonth = parts.find(p => p.type === 'month')?.value;
  const estDay = parts.find(p => p.type === 'day')?.value;
  const estHour = parts.find(p => p.type === 'hour')?.value;
  const estMinute = parts.find(p => p.type === 'minute')?.value;
  const estSecond = parts.find(p => p.type === 'second')?.value;
  
  // Determine if date is in EDT (March-November) or EST by checking the offset
  // Create a date in EST timezone and compare with UTC to determine offset
  const estDateStr = `${estYear}-${estMonth}-${estDay}T${estHour}:${estMinute}:${estSecond}`;
  const testDate = new Date(`${estDateStr}Z`); // Parse as UTC
  const estDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  
  // Calculate offset: EST is UTC-5, EDT is UTC-4
  // Use a more reliable method: check what the offset would be for this date in EST
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const jul1 = new Date(date.getFullYear(), 6, 1);
  const janOffset = -jan1.getTimezoneOffset() / 60; // Hours from UTC
  const julOffset = -jul1.getTimezoneOffset() / 60;
  
  // EST is typically UTC-5, EDT is UTC-4
  // DST runs from second Sunday in March to first Sunday in November
  const isDST = date.getMonth() >= 2 && date.getMonth() <= 10; // Rough check
  const estOffset = isDST ? '-04:00' : '-05:00';
  
  return `${estYear}-${estMonth}-${estDay}T${estHour}:${estMinute}:${estSecond}${estOffset}`;
}

function extractSlotInfo(booking: BookingForOutlook): SlotInfo | null {
  const metadata = booking.metadata || {};
  const slot = metadata.slot || {};

  let start = slot.start ?? booking.booking_date ?? null;
  if (!start) {
    return null;
  }
  let end = slot.end ?? null;
  if (!end) {
    end = computeFallbackEnd(start, booking.service_id);
  }

  // Convert UTC dates to EST for Outlook
  // Outlook interprets dates in the specified timezone, so we need to provide EST times
  const startEST = convertToESTISO(start);
  const endEST = convertToESTISO(end);

  const timeZone = 'America/New_York';
  return { start: startEST, end: endEST, timeZone };
}

function buildSubject(booking: BookingForOutlook): string {
  const service = booking.service_name ?? 'Service';
  
  // Extract first and last name from client_name
  let firstName = '';
  let lastName = '';
  if (booking.client_name) {
    const nameParts = booking.client_name.trim().split(/\s+/);
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
  }
  
  // Format: [Service Name] - [Client First Name] [Client Last Name]
  if (firstName && lastName) {
    return `${service} - ${firstName} ${lastName}`;
  } else if (firstName) {
    return `${service} - ${firstName}`;
  } else if (booking.client_email) {
    // Fallback to email if no name
    return `${service} - ${booking.client_email}`;
  } else {
    return `${service} - Client`;
  }
}

function buildBody(booking: BookingForOutlook): string {
  const lines: string[] = [];
  
  // Service name
  lines.push(`<p><strong>Service name:</strong> ${booking.service_name || 'N/A'}</p>`);
  
  // Client Email
  if (booking.client_email) {
    lines.push(`<p><strong>Email:</strong> ${booking.client_email}</p>`);
  }
  
  // Client Phone
  if (booking.client_phone) {
    lines.push(`<p><strong>Phone:</strong> ${booking.client_phone}</p>`);
  }
  
  // Amount Paid
  const amountPaid = booking.payment_amount_cents 
    ? `$${(booking.payment_amount_cents / 100).toFixed(2)}` 
    : 'N/A';
  lines.push(`<p><strong>Amount Paid:</strong> ${amountPaid}</p>`);
  
  // Discount (only show if discount was given)
  if (booking.discount_code || (booking.discount_amount_cents && booking.discount_amount_cents > 0)) {
    const discountAmount = booking.discount_amount_cents 
      ? `$${(booking.discount_amount_cents / 100).toFixed(2)}` 
      : booking.discount_code || 'Applied';
    lines.push(`<p><strong>Discount:</strong> ${discountAmount}${booking.discount_code ? ` (${booking.discount_code})` : ''}</p>`);
  }
  
  // Refund information (only show if refunded)
  if (booking.refunded_cents && booking.refunded_cents > 0) {
    lines.push(`<p><strong>Refund:</strong> $${(booking.refunded_cents / 100).toFixed(2)}</p>`);
    
    if (booking.refund_reason) {
      lines.push(`<p><strong>Refund Reason:</strong> ${booking.refund_reason}</p>`);
    }
    
    if (booking.refund_date) {
      const refundDate = new Date(booking.refund_date);
      const formattedRefundDate = refundDate.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      lines.push(`<p><strong>Refund Date:</strong> ${formattedRefundDate}</p>`);
    }
  }
  
  // Booked on Date (never changes)
  if (booking.created_at) {
    const bookedDate = new Date(booking.created_at);
    const formattedBookedDate = bookedDate.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    lines.push(`<p><strong>Booked on Date:</strong> ${formattedBookedDate}</p>`);
  }
  
  // Booking ID (Hapio) - never changes
  if (booking.hapio_booking_id) {
    lines.push(`<p><strong>Booking ID (Hapio):</strong> ${booking.hapio_booking_id}</p>`);
  }
  
  // Payment ID (Stripe) - never changes
  if (booking.payment_intent_id) {
    lines.push(`<p><strong>Payment ID (Stripe):</strong> ${booking.payment_intent_id}</p>`);
  }
  
  // Client ID (Neon) - never changes
  if (booking.customer_id) {
    lines.push(`<p><strong>Client ID (Neon):</strong> ${booking.customer_id}</p>`);
  }
  
  // Changes that occurred after booking
  if (booking.booking_events && booking.booking_events.length > 0) {
    // Filter out 'finalized' and 'email_sent' events as they're not user-visible changes
    const changeEvents = booking.booking_events.filter(
      (event) => !['finalized', 'email_sent'].includes(event.type)
    );
    
    if (changeEvents.length > 0) {
      lines.push(`<p><strong>Changes:</strong></p><ul>`);
      changeEvents.forEach((event) => {
        const changeDate = new Date(event.created_at);
        const formattedChangeDate = changeDate.toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        
        let changeDescription = '';
        switch (event.type) {
          case 'rescheduled':
            changeDescription = 'Booking rescheduled';
            if (event.data?.oldDate && event.data?.newDate) {
              changeDescription += ` (from ${new Date(event.data.oldDate).toLocaleDateString()} to ${new Date(event.data.newDate).toLocaleDateString()})`;
            }
            break;
          case 'refund':
            changeDescription = 'Refund processed';
            if (event.data?.amount_cents) {
              changeDescription += ` ($${(event.data.amount_cents / 100).toFixed(2)})`;
            }
            break;
          case 'cancelled':
            changeDescription = 'Booking cancelled';
            break;
          default:
            changeDescription = `Booking ${event.type}`;
        }
        
        lines.push(`<li>${formattedChangeDate}: ${changeDescription}</li>`);
      });
      lines.push(`</ul>`);
    }
  }
  
  return lines.join('\n') || '<p>Booking created from Aura Wellness Aesthetics</p>';
}

export async function ensureOutlookEventForBooking(booking: BookingForOutlook | string | number): Promise<{
  eventId: string | null;
  action: 'created' | 'updated' | 'skipped';
}> {
  // If booking is just an ID, fetch the full booking data
  let fullBooking: BookingForOutlook;
  if (typeof booking === 'string' || typeof booking === 'number') {
    const fetched = await fetchBookingDataForOutlook(booking);
    if (!fetched) {
      console.warn('[Outlook] Could not fetch booking data for ID', booking);
      return { eventId: null, action: 'skipped' };
    }
    fullBooking = fetched;
  } else {
    // If booking object is provided but missing data, try to fetch it
    if (!booking.payment_intent_id || !booking.booking_events) {
      const fetched = await fetchBookingDataForOutlook(booking.id);
      if (fetched) {
        // Merge fetched data with provided booking data
        fullBooking = {
          ...booking,
          ...fetched,
          // Preserve provided fields that might be more up-to-date
          client_name: booking.client_name || fetched.client_name,
          client_email: booking.client_email || fetched.client_email,
          service_name: booking.service_name || fetched.service_name,
          booking_date: booking.booking_date || fetched.booking_date,
          outlook_event_id: booking.outlook_event_id || fetched.outlook_event_id,
          metadata: { ...fetched.metadata, ...booking.metadata },
        };
      } else {
        fullBooking = booking;
      }
    } else {
      fullBooking = booking;
    }
  }

  const slot = extractSlotInfo(fullBooking);

  if (!slot) {
    console.warn('[Outlook] Missing slot information for booking', fullBooking.id);
    return { eventId: fullBooking.outlook_event_id ?? null, action: 'skipped' };
  }

  const payload = {
    subject: buildSubject(fullBooking),
    body: buildBody(fullBooking),
    start: slot.start,
    end: slot.end,
    timeZone: slot.timeZone,
  };

  if (fullBooking.outlook_event_id) {
    await updateOutlookEvent(fullBooking.outlook_event_id, {
      subject: payload.subject,
      body: {
        contentType: 'HTML',
        content: payload.body,
      },
      start: {
        dateTime: payload.start,
        timeZone: payload.timeZone,
      },
      end: {
        dateTime: payload.end,
        timeZone: payload.timeZone,
      },
    });
    return { eventId: fullBooking.outlook_event_id, action: 'updated' };
  }

  const created = await createOutlookEvent(payload);
  return { eventId: created.id, action: 'created' };
}

export async function deleteOutlookEventForBooking(booking: BookingForOutlook): Promise<boolean> {
  if (!booking.outlook_event_id) {
    return false;
  }
  try {
    await deleteOutlookEvent(booking.outlook_event_id);
    return true;
  } catch (error) {
    console.error('[Outlook] Failed to delete event', booking.outlook_event_id, error);
    return false;
  }
}
