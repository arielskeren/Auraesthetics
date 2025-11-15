import { saveOutlookTokens, getOutlookTokens } from './outlookTokenStore';

type GraphTokenResponse = {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
  refresh_token?: string;
};

type BusyBlock = {
  start: string;
  end: string;
  subject?: string | null;
  location?: string | null;
};

const TENANT_ID = process.env.OUTLOOK_TENANT_ID;
const CLIENT_ID = process.env.OUTLOOK_CLIENT_ID;
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI;
const SCOPES = process.env.OUTLOOK_SCOPES ?? 'offline_access User.Read Calendars.ReadWrite';
const CALENDAR_USER = process.env.OUTLOOK_CALENDAR_USER || 'me';

function assertEnv(name: string, value: string | undefined): asserts value {
  if (!value) {
    throw new Error(`Missing required Outlook environment variable: ${name}`);
  }
}

async function fetchGraphToken(body: URLSearchParams): Promise<GraphTokenResponse> {
  assertEnv('OUTLOOK_TENANT_ID', TENANT_ID);

  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await response.json()) as GraphTokenResponse & { error?: string; error_description?: string };

  if (!response.ok) {
    console.error('[Outlook] Token request failed', data);
    throw new Error(data.error_description || data.error || 'Failed to obtain Outlook token');
  }

  return data;
}

export async function exchangeCodeForTokens(code: string) {
  assertEnv('OUTLOOK_CLIENT_ID', CLIENT_ID);
  assertEnv('OUTLOOK_CLIENT_SECRET', CLIENT_SECRET);
  assertEnv('OUTLOOK_REDIRECT_URI', REDIRECT_URI);

  const body = new URLSearchParams({
    client_id: CLIENT_ID!,
    scope: SCOPES,
    code,
    redirect_uri: REDIRECT_URI!,
    grant_type: 'authorization_code',
    client_secret: CLIENT_SECRET!,
  });

  const tokenData = await fetchGraphToken(body);

  await saveOutlookTokens({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresInSeconds: tokenData.expires_in,
    metadata: {
      scope: tokenData.scope,
      tokenType: tokenData.token_type,
      issuedAt: new Date().toISOString(),
    },
  });

  return tokenData;
}

async function refreshAccessToken(refreshToken: string) {
  assertEnv('OUTLOOK_CLIENT_ID', CLIENT_ID);
  assertEnv('OUTLOOK_CLIENT_SECRET', CLIENT_SECRET);
  assertEnv('OUTLOOK_REDIRECT_URI', REDIRECT_URI);

  const body = new URLSearchParams({
    client_id: CLIENT_ID!,
    scope: SCOPES,
    refresh_token: refreshToken,
    redirect_uri: REDIRECT_URI!,
    grant_type: 'refresh_token',
    client_secret: CLIENT_SECRET!,
  });

  const tokenData = await fetchGraphToken(body);

  await saveOutlookTokens({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? refreshToken,
    expiresInSeconds: tokenData.expires_in,
    metadata: {
      scope: tokenData.scope,
      tokenType: tokenData.token_type,
      refreshedAt: new Date().toISOString(),
    },
  });

  return tokenData.access_token;
}

function accessTokenValid(record: Awaited<ReturnType<typeof getOutlookTokens>>): boolean {
  if (!record) return false;
  if (!record.access_token || !record.expires_at) return false;
  const expiry = new Date(record.expires_at).getTime();
  return expiry - Date.now() > 60_000; // at least 1 minute remaining
}

export async function getAccessToken(): Promise<string> {
  const record = await getOutlookTokens();

  if (record && accessTokenValid(record)) {
    return record.access_token!;
  }

  const refreshToken = record?.refresh_token || process.env.OUTLOOK_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      'No Outlook refresh token available. Connect Outlook via /api/auth/outlook/start and store the refresh token.'
    );
  }

  if (!record || record.refresh_token !== refreshToken) {
    await saveOutlookTokens({ accessToken: null, refreshToken });
  }

  return refreshAccessToken(refreshToken);
}

async function graphRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();

  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (response.status === 401) {
    // Attempt one automatic refresh
    const record = await getOutlookTokens();
    const refreshToken = record?.refresh_token || process.env.OUTLOOK_REFRESH_TOKEN;
    if (refreshToken) {
      await refreshAccessToken(refreshToken);
      return graphRequest<T>(path, init);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    console.error('[Outlook] Graph request failed', response.status, text);
    throw new Error(`Outlook API error (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function createOutlookEvent({
  subject,
  body,
  start,
  end,
  timeZone = 'UTC',
}: {
  subject: string;
  body?: string;
  start: string;
  end: string;
  timeZone?: string;
}) {
  const payload = {
    subject,
    body: body
      ? {
          contentType: 'HTML' as const,
          content: body,
        }
      : undefined,
    start: {
      dateTime: start,
      timeZone,
    },
    end: {
      dateTime: end,
      timeZone,
    },
  };

  const data = await graphRequest<{ id: string }>('/me/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return data;
}

export async function updateOutlookEvent(eventId: string, updates: Record<string, unknown>) {
  await graphRequest(`/me/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteOutlookEvent(eventId: string) {
  await graphRequest(`/me/events/${eventId}`, {
    method: 'DELETE',
  });
}

export async function getOutlookBusySlots({
  from,
  to,
  timeZone = 'UTC',
}: {
  from: string;
  to: string;
  timeZone?: string;
}): Promise<BusyBlock[]> {
  const payload = {
    schedules: [CALENDAR_USER],
    startTime: {
      dateTime: from,
      timeZone,
    },
    endTime: {
      dateTime: to,
      timeZone,
    },
    availabilityViewInterval: 30,
  };

  const data = await graphRequest<{
    value?: Array<{
      scheduleId: string;
      scheduleItems?: Array<{
        start: { dateTime: string; timeZone: string };
        end: { dateTime: string; timeZone: string };
        subject?: string;
        location?: { displayName?: string } | null;
      }>;
    }>;
  }>('/me/calendar/getSchedule', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const busyItems = data.value?.[0]?.scheduleItems ?? [];
  return busyItems.map((item) => ({
    start: item.start?.dateTime,
    end: item.end?.dateTime,
    subject: item.subject ?? null,
    location: item.location?.displayName ?? null,
  }));
}

