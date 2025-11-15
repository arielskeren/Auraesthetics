import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/outlookClient';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const sessionState = searchParams.get('session_state');

  // Log all parameters for debugging
  console.log('[Outlook OAuth Callback] Received parameters:', {
    hasError: !!error,
    error,
    errorDescription,
    hasCode: !!code,
    codeLength: code?.length,
    state,
    sessionState,
    allParams: Object.fromEntries(searchParams.entries()),
  });

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
    // Log the full URL to help debug
    console.error('[Outlook OAuth] Missing code parameter. Full URL:', request.url);
    console.error('[Outlook OAuth] Search params:', Object.fromEntries(searchParams.entries()));
    
    return NextResponse.json(
      {
        error: 'Missing authorization code from Outlook',
        debug: {
          url: request.url,
          hasCode: false,
          allParams: Object.fromEntries(searchParams.entries()),
        },
        hint: 'Make sure you completed the Microsoft sign-in and were redirected back. If you accessed this URL directly, please start the OAuth flow from /api/auth/outlook/start',
      },
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
