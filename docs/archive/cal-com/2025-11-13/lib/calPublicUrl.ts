import { getCalEventBookingUrl, getCalUrlParts } from './calEventMapping';

export interface PublicCalUrlOptions {
  params?: Record<string, string | null | undefined>;
}

export interface PublicCalUrlResult {
  url: string;
  parts: ReturnType<typeof getCalUrlParts>;
}

export function buildPublicCalUrl(
  eventTypeId: number,
  options: PublicCalUrlOptions = {}
): PublicCalUrlResult | null {
  const baseUrl = getCalEventBookingUrl(eventTypeId);
  if (!baseUrl) {
    return null;
  }

  try {
    const url = new URL(baseUrl);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          url.searchParams.set(key, value.trim());
        }
      }
    }

    return {
      url: url.toString(),
      parts: getCalUrlParts(baseUrl),
    };
  } catch (error) {
    console.warn('Failed to construct public Cal.com URL', { eventTypeId, error });
    return null;
  }
}

