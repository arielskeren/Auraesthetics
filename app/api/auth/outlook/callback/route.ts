import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/outlookClient';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const code = searchParams.get('code');

  if (error) {
    console.error('[Outlook OAuth] Error response', error, errorDescription);
    return NextResponse.json(
      {
        error: 'Outlook OAuth failed',
        details: errorDescription ?? error,
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Missing authorization code from Outlook' },
      { status: 400 }
    );
  }

  try {
    const tokenData = await exchangeCodeForTokens(code);

    const payload = {
      message: 'Outlook account connected successfully. Tokens stored securely.',
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error('[Outlook OAuth] Token exchange failed', err);
    return NextResponse.json(
      {
        error: 'Failed to exchange authorization code for tokens',
        details: err?.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}
