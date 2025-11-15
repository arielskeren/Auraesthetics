# Outlook OAuth Production Setup Guide

## Step 1: Create the Database Table

Run this SQL in your **Neon Production Database** SQL editor:

```sql
-- Create integration_tokens table for Outlook OAuth tokens
CREATE TABLE IF NOT EXISTS integration_tokens (
  provider VARCHAR(100) PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  metadata JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_provider ON integration_tokens(provider);
```

## Step 2: Update Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: **Azure Active Directory** → **App registrations** → **MyBookingApp – Calendar Sync** (or your app name)
3. Click **Authentication** in the left menu
4. Under **Platform configurations**, find or add **Web** platform
5. Add this redirect URI:
   ```
   https://theauraesthetics.com/api/auth/outlook/callback
   ```
6. **Save** the changes

## Step 3: Update Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **Auraesthetics** project
3. Go to **Settings** → **Environment Variables**
4. Add/Update these variables:

   ```
   OUTLOOK_CLIENT_ID=your_azure_client_id
   OUTLOOK_CLIENT_SECRET=your_azure_client_secret
   OUTLOOK_TENANT_ID=your_azure_tenant_id
   OUTLOOK_REDIRECT_URI=https://theauraesthetics.com/api/auth/outlook/callback
   OUTLOOK_SCOPES=offline_access User.Read Calendars.ReadWrite
   OUTLOOK_SYNC_ENABLED=true
   ```

5. **Redeploy** the application (or wait for auto-deploy on next push)

## Step 4: Connect Outlook Account (Production)

1. Visit: **https://theauraesthetics.com/api/auth/outlook/start**
2. Sign in with your Microsoft account
3. Grant permissions
4. You'll be redirected back and tokens will be stored in the database

## Step 5: Verify Connection

After connecting, you can verify tokens are stored by checking the `integration_tokens` table in your Neon database:

```sql
SELECT provider, 
       CASE WHEN access_token IS NOT NULL THEN 'Token exists' ELSE 'No token' END as token_status,
       expires_at,
       updated_at
FROM integration_tokens
WHERE provider = 'outlook';
```

## Troubleshooting

- **"relation integration_tokens does not exist"**: Run Step 1 SQL in your production database
- **"redirect_uri_mismatch"**: Make sure Azure redirect URI exactly matches `OUTLOOK_REDIRECT_URI` in Vercel
- **"Invalid client secret"**: Verify `OUTLOOK_CLIENT_SECRET` in Vercel matches Azure
- **Tokens not saving**: Check Neon database connection and ensure table exists

