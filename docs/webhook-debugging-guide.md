# Webhook Debugging Guide

## Where to Check Logs

### Local Development (npm run dev)
**Logs appear in your terminal/console where you run `npm run dev`**

1. Open your terminal where you're running the dev server
2. Look for console.log statements from the webhook
3. The webhook logs will show:
   - `Cal.com webhook received: [type]`
   - `Webhook data: [full payload]`
   - `📋 Booking object structure: [details]`
   - `🔍 Extracted values: [payment intent, token, etc.]`

### Production (Vercel)
**Logs are in Vercel Dashboard**

1. Go to https://vercel.com/dashboard
2. Select your project (Auraesthetics)
3. Click on "Logs" tab
4. Filter by function name: `webhooks/cal-com`
5. Or search for "Cal.com webhook received"

### Testing Webhook Locally
Use **Stripe CLI** or **ngrok** to forward Cal.com webhooks to your local server:

#### Option 1: Using ngrok (Recommended)
```bash
# Install ngrok if you don't have it
# brew install ngrok (on Mac)

# Expose your local server
ngrok http 9999

# You'll get a URL like: https://abc123.ngrok.io
# Use this URL as your Cal.com webhook endpoint:
# https://abc123.ngrok.io/api/webhooks/cal-com
```

#### Option 2: Using Stripe CLI (if you have it)
```bash
stripe listen --forward-to localhost:9999/api/webhooks/cal-com
```

## Verify Cal.com Webhook is Configured

1. **Go to Cal.com Dashboard:**
   - Settings → Developer → Webhooks
   - Check if webhook is configured
   - Webhook URL should be: `https://your-domain.com/api/webhooks/cal-com`
   - Or for local: `https://your-ngrok-url.ngrok.io/api/webhooks/cal-com`

2. **Verify Webhook Events:**
   - Make sure `BOOKING_CREATED` event is selected
   - Make sure webhook is active/enabled

3. **Test Webhook:**
   - Cal.com dashboard may have a "Test" button
   - Or create a test booking and check logs

## Common Issues

### Issue 1: Webhook Not Receiving Data
**Symptoms:** No logs appear when booking is created

**Solutions:**
- Check webhook URL is correct in Cal.com dashboard
- Verify webhook is enabled/active
- Check if webhook endpoint is publicly accessible (not localhost)
- For local testing, use ngrok

### Issue 2: Webhook Receiving Data But Not Matching
**Symptoms:** Logs show webhook received but no booking matched

**Solutions:**
- Check logs to see what data Cal.com is sending
- Verify payment intent ID is in the payload
- Check if booking token is in the payload
- Use manual linking tool if needed

### Issue 3: Webhook Matching But Not Updating
**Symptoms:** Logs show match but client info still N/A

**Solutions:**
- Check if Cal.com booking has attendee data
- Verify SQL update is executing correctly
- Check database for updated records

## Manual Testing

You can manually test the webhook by sending a POST request:

```bash
# Test webhook endpoint
curl -X POST http://localhost:9999/api/webhooks/cal-com \
  -H "Content-Type: application/json" \
  -d '{
    "type": "BOOKING_CREATED",
    "data": {
      "booking": {
        "id": "test-booking-123",
        "attendees": [
          {
            "name": "Test User",
            "email": "test@example.com",
            "phone": "555-1234"
          }
        ],
        "startTime": "2025-11-10T10:00:00Z",
        "eventType": {
          "title": "Aura facial",
          "slug": "aura-facial"
        }
      }
    }
  }'
```

## Next Steps

1. **Check your local terminal logs** (if running dev server)
2. **Check Vercel logs** (if deployed)
3. **Verify Cal.com webhook is configured** with correct URL
4. **Test with a real booking** and watch the logs
5. **Use manual linking tool** if webhook doesn't work

