import { getSqlClient } from '@/app/_utils/db';

const PROVIDER_KEY = 'outlook';

export interface OutlookTokenRecord {
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string | null;
}

export interface SaveOutlookTokensInput {
  accessToken: string | null;
  refreshToken?: string | null;
  expiresInSeconds?: number | null;
  metadata?: Record<string, unknown>;
}

const sql = getSqlClient();

function computeExpiry(expiresInSeconds?: number | null): string | null {
  if (!expiresInSeconds || !Number.isFinite(expiresInSeconds)) {
    return null;
  }
  const bufferSeconds = 60; // refresh one minute early
  const expiry = new Date(Date.now() + Math.max(0, expiresInSeconds - bufferSeconds) * 1000);
  return expiry.toISOString();
}

export async function getOutlookTokens(): Promise<OutlookTokenRecord | null> {
  const result = await sql`
    SELECT provider, access_token, refresh_token, expires_at, metadata, updated_at
    FROM integration_tokens
    WHERE provider = ${PROVIDER_KEY}
    LIMIT 1
  `;

  const rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    provider: row.provider,
    access_token: row.access_token ?? null,
    refresh_token: row.refresh_token ?? null,
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    metadata: row.metadata ?? null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  } as OutlookTokenRecord;
}

export async function saveOutlookTokens(input: SaveOutlookTokensInput): Promise<void> {
  const expiresAt = computeExpiry(input.expiresInSeconds);

  await sql`
    INSERT INTO integration_tokens (provider, access_token, refresh_token, expires_at, metadata, updated_at)
    VALUES (
      ${PROVIDER_KEY},
      ${input.accessToken},
      ${input.refreshToken ?? null},
      ${expiresAt}::timestamp,
      ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
      NOW()
    )
    ON CONFLICT (provider) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, integration_tokens.refresh_token),
      expires_at = EXCLUDED.expires_at,
      metadata = COALESCE(EXCLUDED.metadata, integration_tokens.metadata),
      updated_at = NOW()
  `;
}

export async function clearOutlookTokens(): Promise<void> {
  await sql`
    DELETE FROM integration_tokens WHERE provider = ${PROVIDER_KEY}
  `;
}
