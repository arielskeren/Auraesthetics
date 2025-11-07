# Webhook Setup Summary

## ✅ You're Correct - Use Production URL

**Yes, webhooks should point to your production site**, not localhost. Cal.com can't reach `localhost`.

## Current Issues Found

### 1. ✅ Fixed: Metadata Extraction
Cal.com stores metadata in a custom field `a` as a JSON string. The webhook handler has been updated to parse this.

**Example from your bookings:**
```json
{
  "metadata": {
    "a": "{\"paymentIntentId\":\"pi_3SQKn1E9ZoKS3Yz309Hr20Ep\",\"discountCode\":\"WELCOME15\",\"paymentType\":\"full\",\"bookingToken\":\"...\"}"
  }
}
```

### 2. ⚠️ URL Redirect Issue
Your site redirects from `theauraesthetics.com` to `www.theauraesthetics.com`. This might cause webhook issues.

**Solution:** Configure Cal.com webhook to use the **www** version:
```
https://www.theauraesthetics.com/api/webhooks/cal-com
```

### 3. ✅ Manual Sync Completed
5 bookings were manually synced and now have Cal.com data.

## Next Steps

### Step 1: Verify Webhook Endpoint
Test both URLs:
- `https://theauraesthetics.com/api/webhooks/cal-com` (redirects to www)
- `https://www.theauraesthetics.com/api/webhooks/cal-com` (should work)

Both should return: `{"message":"Cal.com webhook endpoint is active","status":"ok"}`

### Step 2: Configure Cal.com Webhook
1. Go to: https://app.cal.com/settings/developer/webhooks
2. Create/edit webhook:
   - **URL:** `https://www.theauraesthetics.com/api/webhooks/cal-com` (use www version)
   - **Event:** `BOOKING_CREATED`
   - **Status:** Active
3. Save

### Step 3: Check Vercel Logs
After configuring:
1. Go to Vercel Dashboard → Logs
2. Create a test booking
3. Watch for: `Cal.com webhook received: BOOKING_CREATED`

### Step 4: If Webhook Still Doesn't Work
Run manual sync periodically:
```bash
npm run sync-cal-bookings
```

## Quick Commands

```bash
# Check webhook status and recent bookings
npm run check-webhook

# Manually sync bookings (if webhook doesn't work)
npm run sync-cal-bookings
```

## Summary

- ✅ Webhook handler updated to parse Cal.com metadata format
- ✅ 5 bookings manually synced
- ⚠️ Use `www.theauraesthetics.com` for webhook URL (not non-www)
- ⚠️ Verify webhook is configured in Cal.com dashboard
- ⚠️ Check Vercel logs to see if webhooks are being received

