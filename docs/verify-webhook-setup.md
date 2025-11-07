# Verify Cal.com Webhook Setup

## ✅ You're Correct - Webhooks Should Point to Production

Webhooks should point to **your production site** (`https://theauraesthetics.com`), NOT localhost. Cal.com can't reach `localhost`.

## Current Status

Based on the sync script results:
- ✅ **5 bookings were manually synced** and now have Cal.com data
- ⚠️ **Webhook endpoint might not be accessible** (404 error when tested)
- ⚠️ **Webhook might not be configured** in Cal.com dashboard

## Step 1: Verify Webhook Endpoint is Deployed

The webhook endpoint should be accessible at:
```
https://theauraesthetics.com/api/webhooks/cal-com
```

**Test it:**
1. Open in browser: https://theauraesthetics.com/api/webhooks/cal-com
2. Should return: `{"message":"Cal.com webhook endpoint is active","status":"ok"}`

**If you get 404 or redirect:**
- The route might not be deployed
- Check Vercel deployment logs
- Make sure the file exists: `app/api/webhooks/cal-com/route.ts`
- Redeploy if needed

## Step 2: Configure Webhook in Cal.com Dashboard

1. **Go to Cal.com Dashboard:**
   - Visit: https://app.cal.com/settings/developer/webhooks
   - Or: Settings → Developer → Webhooks

2. **Check if webhook exists:**
   - Look for webhook with URL: `https://theauraesthetics.com/api/webhooks/cal-com`
   - If it doesn't exist, create it

3. **Create/Edit Webhook:**
   - Click **"+ New Webhook"** (or edit existing)
   - **Subscriber URL:** `https://theauraesthetics.com/api/webhooks/cal-com`
   - **Event:** Select `BOOKING_CREATED` (or `booking.created`)
   - **Status:** Make sure it's **Active/Enabled**
   - **Save**

4. **Test the webhook:**
   - Cal.com dashboard might have a "Test" button
   - Or create a test booking and check Vercel logs

## Step 3: Check Vercel Logs

**To see if webhooks are being received:**

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your project: **Auraesthetics**

2. **View Logs:**
   - Click **"Logs"** tab
   - Filter by function: `webhooks/cal-com`
   - Or search for: "Cal.com webhook received"

3. **What to look for:**
   - `Cal.com webhook received: BOOKING_CREATED`
   - `Webhook data: { ... }`
   - `✅ Updated booking with Cal.com data`
   - Or error messages

## Step 4: Test the Webhook

1. **Make a test booking:**
   - Go through payment flow on your site
   - Complete Cal.com booking
   - Watch Vercel logs for webhook call

2. **If webhook fires but doesn't match:**
   - Check logs for extracted payment intent ID
   - Check if booking token is in metadata
   - Use manual linking tool if needed

## Step 5: Manual Sync (If Webhook Doesn't Work)

If webhooks aren't working, you can manually sync bookings:

```bash
npm run sync-cal-bookings
```

This will:
- Fetch recent Cal.com bookings
- Match them with database bookings
- Update database with Cal.com data

**Run this periodically** until webhooks are working.

## Common Issues

### Issue 1: Webhook Endpoint Returns 404
**Solution:**
- Check if route file exists: `app/api/webhooks/cal-com/route.ts`
- Redeploy to Vercel
- Check Vercel deployment logs

### Issue 2: Webhook Not Configured in Cal.com
**Solution:**
- Go to Cal.com dashboard → Settings → Developer → Webhooks
- Create webhook with correct URL
- Make sure it's active

### Issue 3: Webhook Fires But Doesn't Match
**Solution:**
- Check Vercel logs for webhook payload
- Verify payment intent ID is in metadata
- Use manual sync tool as backup

### Issue 4: Can't See Vercel Logs
**Solution:**
- Make sure you're logged into Vercel
- Check project settings
- Try Vercel CLI: `vercel logs --follow`

## Next Steps

1. ✅ **5 bookings were synced** - Check admin dashboard now
2. ⚠️ **Verify webhook endpoint** is accessible
3. ⚠️ **Configure webhook** in Cal.com dashboard
4. ⚠️ **Check Vercel logs** for webhook activity
5. ⚠️ **Test with a new booking** and watch logs

## Quick Commands

```bash
# Check webhook status
npm run check-webhook

# Manually sync bookings
npm run sync-cal-bookings

# View Vercel logs (if CLI installed)
vercel logs --follow
```

