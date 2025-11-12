import services from '@/app/_content/services.json';

interface ServiceEntry {
  slug?: string;
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
const SERVICE_EMBED_MAP = new Map<
  string,
  {
    slug: string;
    bookingUrl: string | null;
    calLink: string | null;
    namespace: string;
    elementId: string;
  }
>();
const CAL_LINK_TO_SLUG_MAP = new Map<string, string>();

const DEFAULT_INLINE_CONFIG = Object.freeze({
  layout: 'column_view',
  theme: 'light',
});

const DEFAULT_UI_CONFIG = Object.freeze({
  theme: 'light',
  cssVarsPerTheme: {
    light: {
      'cal-brand': '#6B635B',
    },
    dark: {
      'cal-brand': '#B7C8B1',
    },
  },
  hideEventTypeDetails: true,
  layout: 'column_view',
});

function normalizeCalLink(calLink: string | null | undefined): string | null {
  if (!calLink) {
    return null;
  }

  let value = calLink.trim();
  if (!value) {
    return null;
  }

  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const url = new URL(value);
      value = url.pathname;
    }
  } catch {
    // If parsing fails, fall through and attempt to normalize the string as-is
  }

  value = value.replace(/^\/+/, '').replace(/\/+$/, '');

  return value || null;
}

for (const service of services as ServiceEntry[]) {
  if (service.calEventId) {
    EVENT_MAP.set(service.calEventId, {
      bookingUrl: service.calBookingUrl ?? null,
    });
  }

  if (service.slug) {
    const normalizedLink = normalizeCalLink(service.calBookingUrl);
    const namespace = service.slug;
    const elementId = `my-cal-inline-${namespace}`;

    SERVICE_EMBED_MAP.set(service.slug, {
      slug: service.slug,
      bookingUrl: service.calBookingUrl ?? null,
      calLink: normalizedLink,
      namespace,
      elementId,
    });

    if (normalizedLink) {
      CAL_LINK_TO_SLUG_MAP.set(normalizedLink, service.slug);
    }
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

export interface CalServiceEmbedConfig {
  slug: string;
  namespace: string;
  elementId: string;
  calLink: string;
  bookingUrl: string | null;
  inlineConfig: Record<string, any>;
  uiConfig: Record<string, any>;
}

function buildEmbedConfig(record: {
  slug: string;
  namespace: string;
  elementId: string;
  calLink: string | null;
  bookingUrl: string | null;
}): CalServiceEmbedConfig | null {
  if (!record.calLink) {
    return null;
  }

  return {
    slug: record.slug,
    namespace: record.namespace,
    elementId: record.elementId,
    calLink: record.calLink,
    bookingUrl: record.bookingUrl,
    inlineConfig: { ...DEFAULT_INLINE_CONFIG },
    uiConfig: { ...DEFAULT_UI_CONFIG },
  };
}

export function getCalEmbedConfigBySlug(slug: string | null | undefined): CalServiceEmbedConfig | null {
  if (!slug) {
    return null;
  }
  const record = SERVICE_EMBED_MAP.get(slug);
  if (!record) {
    return null;
  }
  return buildEmbedConfig(record);
}

export function getCalEmbedConfigByCalLink(calLink: string | null | undefined): CalServiceEmbedConfig | null {
  const normalized = normalizeCalLink(calLink);
  if (!normalized) {
    return null;
  }
  const slug = CAL_LINK_TO_SLUG_MAP.get(normalized);
  if (!slug) {
    return null;
  }
  const record = SERVICE_EMBED_MAP.get(slug);
  if (!record) {
    return null;
  }
  return buildEmbedConfig(record);
}


