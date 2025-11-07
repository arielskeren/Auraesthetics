# Where to Check Server Logs

## Local Development (npm run dev)

**Your logs are in the terminal where you run `npm run dev`**

1. Open the terminal where you started the dev server
2. Look for console.log output
3. Webhook logs will show:
   - `Cal.com webhook received: [type]`
   - `Webhook data: [payload]`
   - `📋 Booking object structure: [details]`

**Example:**
```bash
# In your terminal where you run: npm run dev
Cal.com webhook received: BOOKING_CREATED
Webhook data: { ... }
```

## Production (Vercel)

**Logs are in Vercel Dashboard**

1. Go to: https://vercel.com/dashboard
2. Click on your project: **Auraesthetics**
3. Click on the **"Logs"** tab (or **"Functions"** → **"Logs"**)
4. Filter by function name: `webhooks/cal-com`
5. Or search for: "Cal.com webhook received"

**Alternative:** You can also use Vercel CLI:
```bash
vercel logs --follow
```

## Testing Webhook Locally

Since Cal.com can't send webhooks to `localhost`, you need to use a tunnel:

### Option 1: ngrok (Recommended)

1. **Install ngrok:**
   ```bash
   brew install ngrok  # Mac
   # or download from https://ngrok.com
   ```

2. **Start your dev server:**
   ```bash
   npm run dev
   ```

3. **In another terminal, start ngrok:**
   ```bash
   ngrok http 9999
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Configure Cal.com webhook:**
   - Go to: https://app.cal.com/settings/developer/webhooks
   - Add webhook URL: `https://abc123.ngrok.io/api/webhooks/cal-com`
   - Select event: `BOOKING_CREATED`
   - Save

6. **Watch your terminal** where `npm run dev` is running for webhook logs

### Option 2: Vercel Preview Deployments

Every PR/branch gets a preview URL automatically. You can use that for webhook testing.

## Check Webhook Status

Run this script to check if your webhook is configured:

```bash
npm run check-webhook
```

This will:
- Show your expected webhook URL
- Test if the endpoint is accessible
- Show recent Cal.com bookings
- Provide instructions for setup

## Manual Sync Tool

If webhooks aren't working, you can manually sync bookings:

```bash
npm run sync-cal-bookings
```

This script:
- Fetches recent bookings from Cal.com API
- Matches them with database bookings by email/service
- Updates database with Cal.com booking data

## Quick Debug Steps

1. **Check if webhook is configured:**
   - Go to Cal.com dashboard → Settings → Developer → Webhooks
   - Verify webhook URL is correct
   - Verify `BOOKING_CREATED` event is selected

2. **Test webhook endpoint:**
   ```bash
   # Visit in browser or use curl:
   curl https://theauraesthetics.com/api/webhooks/cal-com
   # Should return: {"message":"Cal.com webhook endpoint is active","status":"ok"}
   ```

3. **Check logs:**
   - Local: Terminal where `npm run dev` is running
   - Production: Vercel dashboard → Logs

4. **Create a test booking:**
   - Make a payment
   - Complete Cal.com booking
   - Watch logs for webhook call

5. **If webhook doesn't fire:**
   - Use manual sync: `npm run sync-cal-bookings`
   - Or use manual linking tool in admin dashboard

