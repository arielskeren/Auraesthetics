import { NextResponse } from 'next/server';
import { getOutlookTokens } from '@/lib/outlookTokenStore';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const tokens = await getOutlookTokens();

    if (!tokens) {
      return NextResponse.json({
        connected: false,
        message: 'Outlook is not connected. Visit /api/auth/outlook/start to connect.',
      });
    }

    const hasAccessToken = !!tokens.access_token;
    const hasRefreshToken = !!tokens.refresh_token;
    const expiresAt = tokens.expires_at ? new Date(tokens.expires_at) : null;
    const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : null;
    const expiresIn = expiresAt
      ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      : null;

    return NextResponse.json({
      connected: true,
      hasAccessToken,
      hasRefreshToken,
      expiresAt: expiresAt?.toISOString() ?? null,
      expiresInSeconds: expiresIn,
      expiresInMinutes: expiresIn ? Math.floor(expiresIn / 60) : null,
      isExpired,
      lastUpdated: tokens.updated_at,
      message: isExpired
        ? 'Tokens expired but refresh token available. Will auto-refresh on next use.'
        : hasRefreshToken
        ? 'Outlook is connected and ready to sync calendar events.'
        : 'Outlook is connected but no refresh token. Reconnect if sync fails.',
    });
  } catch (error: any) {
    console.error('[Outlook Status] Error', error);
    return NextResponse.json(
      {
        connected: false,
        error: error?.message ?? 'Failed to check Outlook connection status',
      },
      { status: 500 }
    );
  }
}

