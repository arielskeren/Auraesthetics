import { calPost } from './calClient';

export interface CalPrivateLink {
  linkId: string;
  eventTypeId: number;
  bookingUrl: string;
  expiresAt: string;
  isExpired: boolean;
}

interface CreatePrivateLinkOptions {
  expiresAt?: string;
  maxUsageCount?: number;
}

const PRIVATE_LINK_API_VERSION = '2024-09-04';

export async function createCalPrivateLink(
  eventTypeId: number,
  options: CreatePrivateLinkOptions = {}
): Promise<CalPrivateLink> {
  const payload: Record<string, any> = {};

  if (options.expiresAt) {
    payload.expiresAt = options.expiresAt;
  }

  if (options.maxUsageCount) {
    payload.maxUsageCount = options.maxUsageCount;
  }

  const data = await calPost<CalPrivateLink>(`event-types/${eventTypeId}/private-links`, payload, {
    headers: {
      'cal-api-version': PRIVATE_LINK_API_VERSION,
    },
  });
  return data;
}

