import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const tenantId = process.env.OUTLOOK_TENANT_ID;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI;
  const scopes = process.env.OUTLOOK_SCOPES ?? 'offline_access User.Read Calendars.ReadWrite';

  if (!clientId || !tenantId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          'Missing Outlook OAuth configuration. Please set OUTLOOK_CLIENT_ID, OUTLOOK_TENANT_ID, and OUTLOOK_REDIRECT_URI.',
      },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scopes.replace(/\s+/g, ' '),
    state: 'outlook-auth',
  });

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
