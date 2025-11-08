import { AxiosError } from 'axios';
import { calPost, calRequest } from './calClient';
import { CAL_CONFIG } from './calConfig';

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

type PrivateLinkScope = 'user' | 'team' | 'unknown';

interface PrivateLinkPath {
  scope: PrivateLinkScope;
  path: string;
}

interface EventTypeContext {
  scope: PrivateLinkScope;
  eventType: Record<string, any> | null;
  attemptedPaths: PrivateLinkPath[];
}

function extractEventSlug(eventType: Record<string, any> | null): string | null {
  if (!eventType) return null;
  return (
    eventType.slug ??
    eventType.eventSlug ??
    eventType.metadata?.slug ??
    eventType.urlSlug ??
    null
  );
}

async function fetchEventTypeContext(eventTypeId: number): Promise<EventTypeContext> {
  const attemptedPaths: PrivateLinkPath[] = [];

  try {
    const response = await calRequest<any>('get', `event-types/${eventTypeId}`, {
      headers: { 'cal-api-version': PRIVATE_LINK_API_VERSION },
    });
    const eventType = response.data ?? response;
    return {
      scope: 'user',
      eventType,
      attemptedPaths: [{ scope: 'user', path: `event-types/${eventTypeId}` }],
    };
  } catch (error: any) {
    const status = error?.response?.status ?? null;
    attemptedPaths.push({ scope: 'user', path: `event-types/${eventTypeId}` });
    if (status && status !== 404) {
      throw error;
    }
  }

  if (CAL_CONFIG.organizationId && CAL_CONFIG.teamId) {
    const teamPath = `organizations/${CAL_CONFIG.organizationId}/teams/${CAL_CONFIG.teamId}/event-types/${eventTypeId}`;
    try {
      const response = await calRequest<any>('get', teamPath, {
        headers: { 'cal-api-version': PRIVATE_LINK_API_VERSION },
      });
      const eventType = response.data ?? response;
      attemptedPaths.push({ scope: 'team', path: teamPath });
      return {
        scope: 'team',
        eventType,
        attemptedPaths,
      };
    } catch (error: any) {
      attemptedPaths.push({ scope: 'team', path: teamPath });
      const status = error?.response?.status ?? null;
      if (status && status !== 404) {
        throw error;
      }
    }
  }

  return {
    scope: 'unknown',
    eventType: null,
    attemptedPaths,
  };
}

function buildCandidatePaths(
  eventTypeId: number,
  context: EventTypeContext
): PrivateLinkPath[] {
  const paths: PrivateLinkPath[] = [];

  const teamPath =
    CAL_CONFIG.organizationId && CAL_CONFIG.teamId
      ? `organizations/${CAL_CONFIG.organizationId}/teams/${CAL_CONFIG.teamId}/event-types/${eventTypeId}/private-links`
      : null;
  const userPath = `event-types/${eventTypeId}/private-links`;

  if (context.scope === 'team' && teamPath) {
    paths.push({ scope: 'team', path: teamPath });
  }

  // Always try user path (many events are individual)
  paths.push({ scope: 'user', path: userPath });

  if (context.scope !== 'team' && teamPath) {
    paths.push({ scope: 'team', path: teamPath });
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return paths.filter((candidate) => {
    if (seen.has(candidate.path)) {
      return false;
    }
    seen.add(candidate.path);
    return true;
  });
}

export async function createCalPrivateLink(
  eventTypeId: number,
  options: CreatePrivateLinkOptions = {}
): Promise<CalPrivateLink> {
  const context = await fetchEventTypeContext(eventTypeId);
  const candidatePaths = buildCandidatePaths(eventTypeId, context);

  const payload: Record<string, any> = {};

  if (options.expiresAt) {
    payload.expiresAt = options.expiresAt;
  }

  if (options.maxUsageCount) {
    payload.maxUsageCount = options.maxUsageCount;
  }

  let lastError: AxiosError | null = null;

  for (const candidate of candidatePaths) {
    try {
      const data = await calPost<CalPrivateLink>(candidate.path, payload, {
        headers: {
          'cal-api-version': PRIVATE_LINK_API_VERSION,
        },
      });

      if (candidate.scope === 'team') {
        console.log(
          `[Cal.com] Created team private link for event ${eventTypeId} via ${candidate.path}`
        );
      }

      return data;
    } catch (error: any) {
      const status = error?.response?.status ?? null;
      if (status === 404) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  const eventSlug = extractEventSlug(context.eventType);
  const attempted = candidatePaths.map((candidate) => candidate.path).join(', ');
  console.warn(
    `[Cal.com] Failed to create private link for event ${eventTypeId} (slug: ${eventSlug ?? 'unknown'}). Attempted paths: ${attempted}`
  );

  if (lastError) {
    throw lastError;
  }

  throw new Error(`Unable to create private link for event ${eventTypeId}`);
}

