# Brevo Sync Features

## Overview

This document describes the automated and manual Brevo synchronization features that ensure Neon (source of truth) stays in sync with Brevo.

## Features Implemented

### 1. Enhanced Clients Manager UI

The Clients Manager (`/admindash/amy/hapio`) now includes:

- **Four View Modes:**
  - **Neon**: View all Neon customers (source of truth)
  - **Brevo**: View all Brevo contacts
  - **Matched**: View customers that exist in both Neon and Brevo (shows sync status)
  - **Unmatched**: View Neon customers not yet in Brevo (need sync)

- **Visual Indicators:**
  - Green checkmark (✓) for customers that exist in Brevo
  - Red X for customers not in Brevo
  - Marketing opt-in status
  - Welcome offer usage status

- **Individual Sync Actions:**
  - "Push to Brevo" button for each customer (only shown if marketing opt-in is enabled)
  - Button is disabled if customer already exists in Brevo

### 2. Bulk Sync Functionality

- **"Sync All to Brevo" Button:**
  - Located in the "Unmatched" view
  - Syncs all Neon customers with `marketing_opt_in = true` to Brevo
  - Shows progress and results (synced count, failed count)
  - Updates `brevo_contact_id` in Neon after successful sync

- **API Endpoint:** `/api/admin/customers/sync-all`
  - `POST`: Triggers sync of all customers
  - `GET`: Returns sync status (total, synced, pending)

### 3. Automated Hourly Sync (Vercel Cron)

- **Cron Job:** Runs every hour automatically
- **Endpoint:** `/api/cron/sync-brevo`
- **Schedule:** `0 * * * *` (every hour at minute 0)
- **Configuration:** `vercel.json`

**What it does:**
- Fetches all Neon customers with `marketing_opt_in = true`
- Syncs each customer to Brevo using `syncCustomerToBrevo()`
- Updates `brevo_contact_id` in Neon after successful sync
- Logs errors for failed syncs (non-blocking)

**Security:**
- Verifies request is from Vercel Cron (checks `x-vercel-cron` header)
- Optional: Set `CRON_SECRET` environment variable for additional security

## How It Works

### Sync Logic

1. **Source of Truth:** Neon database is always the source of truth
2. **Sync Direction:** Neon → Brevo (one-way sync)
3. **Filter:** Only customers with `marketing_opt_in = true` are synced
4. **Matching:** Customers are matched by email address (case-insensitive)

### Sync Process

1. Fetch customer from Neon
2. Check if customer has `marketing_opt_in = true`
3. If yes, call `syncCustomerToBrevo()` which:
   - Creates or updates contact in Brevo
   - Sets Brevo attributes (FIRSTNAME, LASTNAME, PHONE, USED_WELCOME_OFFER)
   - Adds customer to Brevo list (if `BREVO_LIST_ID` is set)
   - Returns Brevo contact ID
4. Update `brevo_contact_id` in Neon with the returned ID

### Matching Logic

- **Matched Records:** Neon customer email exists in Brevo (case-insensitive match)
- **Unmatched Records:** Neon customer email does not exist in Brevo
- **Brevo-only Records:** Brevo contact email does not exist in Neon (shown in Brevo view)

## API Endpoints

### `/api/admin/customers/sync-all`

**POST** - Sync all customers to Brevo
```json
{
  "success": true,
  "message": "Synced 25 of 30 customers to Brevo",
  "synced": 25,
  "failed": 5,
  "total": 30,
  "results": [
    {
      "customerId": "uuid",
      "email": "customer@example.com",
      "success": true,
      "brevoId": 12345
    }
  ]
}
```

**GET** - Get sync status
```json
{
  "total": 30,
  "synced": 25,
  "pending": 5
}
```

### `/api/cron/sync-brevo`

**GET** - Automated hourly sync (called by Vercel Cron)
- Requires Vercel Cron header or `CRON_SECRET` authorization
- Returns similar response to POST `/api/admin/customers/sync-all`

## Configuration

### Environment Variables

- `BREVO_API_KEY`: Brevo API key (required)
- `BREVO_LIST_ID`: Brevo list ID to add customers to (optional)
- `CRON_SECRET`: Optional secret for cron endpoint security (optional)

### Vercel Configuration

The `vercel.json` file configures the cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-brevo",
      "schedule": "0 * * * *"
    }
  ]
}
```

## Usage

### Manual Sync (Individual Customer)

1. Navigate to Clients Manager (`/admindash/amy/hapio`)
2. Switch to "Neon" or "Unmatched" view
3. Click "Push to Brevo" button next to a customer
4. Wait for confirmation message

### Manual Sync (All Customers)

1. Navigate to Clients Manager
2. Switch to "Unmatched" view
3. Review the sync status (shows pending count)
4. Click "Sync All to Brevo" button
5. Confirm the action
6. Wait for completion (may take a few minutes for large lists)

### Automated Sync

- Runs automatically every hour via Vercel Cron
- No manual intervention required
- Check Vercel logs for sync results

## Monitoring

### View Sync Status

- **In UI:** Check the "Unmatched" view for sync status card
- **Via API:** `GET /api/admin/customers/sync-all`

### Check Cron Logs

- Vercel Dashboard → Project → Functions → Cron Jobs
- View execution logs and results

## Troubleshooting

### Sync Not Working

1. **Check Environment Variables:**
   - Ensure `BREVO_API_KEY` is set
   - Ensure `BREVO_LIST_ID` is set (if using lists)

2. **Check Customer Status:**
   - Only customers with `marketing_opt_in = true` are synced
   - Check if customer has valid email address

3. **Check Brevo API:**
   - Verify Brevo API key is valid
   - Check Brevo API rate limits

### Cron Not Running

1. **Check Vercel Configuration:**
   - Ensure `vercel.json` is committed to repository
   - Verify cron schedule is correct

2. **Check Vercel Dashboard:**
   - Go to Project → Settings → Cron Jobs
   - Verify cron job is configured
   - Check execution logs

3. **Check Authorization:**
   - If `CRON_SECRET` is set, ensure it matches
   - Vercel automatically adds `x-vercel-cron` header

## Best Practices

1. **Regular Monitoring:**
   - Check "Unmatched" view weekly to ensure sync is working
   - Review cron logs monthly

2. **Manual Sync:**
   - Use "Sync All" sparingly (only when needed)
   - Individual syncs are faster and less resource-intensive

3. **Data Consistency:**
   - Always update customer data in Neon (source of truth)
   - Brevo will be updated automatically via cron or manual sync

4. **Error Handling:**
   - Failed syncs are logged but don't block other syncs
   - Review error logs to identify problematic customers

## Future Enhancements

- [ ] Add sync history/audit log
- [ ] Add last sync timestamp display
- [ ] Add retry mechanism for failed syncs
- [ ] Add sync conflict resolution (when data differs)
- [ ] Add bulk update from Brevo to Neon (if needed)

