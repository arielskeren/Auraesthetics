import services from '@/app/_content/services.json';

interface ServiceEntry {
  calEventId?: number | null;
  calBookingUrl?: string | null;
}

interface CalUrlParts {
  username?: string | null;
  organizationSlug?: string | null;
  teamSlug?: string | null;
  eventSlug: string | null;
}

const EVENT_MAP = new Map<number, { bookingUrl: string | null }>();

for (const service of services as ServiceEntry[]) {
  if (service.calEventId) {
    EVENT_MAP.set(service.calEventId, {
      bookingUrl: service.calBookingUrl ?? null,
    });
  }
}

export function getCalEventBookingUrl(eventTypeId: number): string | null {
  return EVENT_MAP.get(eventTypeId)?.bookingUrl ?? null;
}

export function getCalUrlParts(bookingUrl: string | null | undefined): CalUrlParts {
  if (!bookingUrl) {
    return { eventSlug: null };
  }

  try {
    const url = new URL(bookingUrl);
    const segments = url.pathname.split('/').filter(Boolean);

    if (segments.length === 2) {
      const [username, eventSlug] = segments;
      return { username, eventSlug };
    }

    if (segments.length === 3) {
      const [organizationSlug, teamSlug, eventSlug] = segments;
      return { organizationSlug, teamSlug, eventSlug };
    }

    return { eventSlug: segments.at(-1) ?? null };
  } catch {
    return { eventSlug: null };
  }
}


