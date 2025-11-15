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
    
    // Return user-friendly HTML error page
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Outlook Connection Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .card {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #d32f2f; margin-top: 0; }
            .error { color: #666; margin: 20px 0; }
            .hint { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            a { color: #1976d2; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>❌ Outlook Connection Failed</h1>
            <p class="error">Missing authorization code from Outlook.</p>
            <div class="hint">
              <strong>What to do:</strong>
              <ul>
                <li>Make sure you completed the Microsoft sign-in process</li>
                <li>If you accessed this page directly, please start over</li>
                <li>Try the connection again: <a href="/api/auth/outlook/start">Connect Outlook</a></li>
              </ul>
            </div>
            <p>If this problem persists, please check that the redirect URI in Azure matches exactly: <code>${process.env.OUTLOOK_REDIRECT_URI || 'Not configured'}</code></p>
          </div>
        </body>
      </html>
    `;
    
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Verify state parameter for security (optional but recommended)
  if (state && state !== 'outlook-auth') {
    console.warn('[Outlook OAuth] State mismatch', { expected: 'outlook-auth', received: state });
    // Don't fail, but log it
  }

  try {
    const tokenData = await exchangeCodeForTokens(code);

    // Return user-friendly HTML success page
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Outlook Connected Successfully</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .card {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              text-align: center;
            }
            h1 { color: #2e7d32; margin-top: 0; }
            .success { color: #666; margin: 20px 0; }
            .checkmark { font-size: 48px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="checkmark">✅</div>
            <h1>Outlook Connected Successfully!</h1>
            <p class="success">Your Outlook calendar is now connected. Calendar sync is active.</p>
            <p style="color: #999; font-size: 14px;">You can close this window.</p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err: any) {
    console.error('[Outlook OAuth] Token exchange failed', err);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Outlook Connection Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .card {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #d32f2f; margin-top: 0; }
            .error { color: #666; margin: 20px 0; }
            code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>❌ Connection Failed</h1>
            <p class="error">Failed to exchange authorization code for tokens.</p>
            <p><strong>Error:</strong> <code>${err?.message ?? 'Unknown error'}</code></p>
            <p style="margin-top: 20px;"><a href="/api/auth/outlook/start">Try again</a></p>
          </div>
        </body>
      </html>
    `;
    
    return new NextResponse(html, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
