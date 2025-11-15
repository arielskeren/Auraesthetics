import { createOutlookEvent, deleteOutlookEvent, updateOutlookEvent } from './outlookClient';
import { getServiceBySlug } from './serviceCatalog';

export interface BookingForOutlook {
  id: string | number;
  service_id: string | null;
  service_name: string | null;
  client_name: string | null;
  client_email: string | null;
  metadata?: any;
  booking_date?: string | null;
  outlook_event_id?: string | null;
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

  const timeZone = metadata.timezone || 'America/New_York';
  return { start, end, timeZone };
}

function buildSubject(booking: BookingForOutlook): string {
  const service = booking.service_name ?? 'Service';
  const client = booking.client_name ?? booking.client_email ?? 'Client';
  return `${client} – ${service}`;
}

function buildBody(booking: BookingForOutlook): string {
  const lines = [
    booking.client_name ? `<p><strong>Client:</strong> ${booking.client_name}</p>` : '',
    booking.client_email ? `<p><strong>Email:</strong> ${booking.client_email}</p>` : '',
    booking.service_name ? `<p><strong>Service:</strong> ${booking.service_name}</p>` : '',
  ].filter(Boolean);
  return lines.join('\n') || '<p>Booking created from Aura Wellness Aesthetics</p>';
}

export async function ensureOutlookEventForBooking(booking: BookingForOutlook): Promise<{
  eventId: string | null;
  action: 'created' | 'updated' | 'skipped';
}> {
  const slot = extractSlotInfo(booking);

  if (!slot) {
    console.warn('[Outlook] Missing slot information for booking', booking.id);
    return { eventId: booking.outlook_event_id ?? null, action: 'skipped' };
  }

  const payload = {
    subject: buildSubject(booking),
    body: buildBody(booking),
    start: slot.start,
    end: slot.end,
    timeZone: slot.timeZone,
  };

  if (booking.outlook_event_id) {
    await updateOutlookEvent(booking.outlook_event_id, {
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
    return { eventId: booking.outlook_event_id, action: 'updated' };
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
