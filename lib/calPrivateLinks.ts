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

  const data = await calPost<CalPrivateLink>(`event-types/${eventTypeId}/private-links`, payload);
  return data;
}

