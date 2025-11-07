# Expired Booking Token Handling

## Overview

When a customer completes payment but doesn't book their appointment within 30 minutes, the booking token expires. This document explains how to handle these situations.

## What Happens When Tokens Expire

1. **Token Expiration**: Booking tokens expire 30 minutes after payment
2. **Webhook Rejection**: Cal.com webhook will reject bookings with expired tokens
3. **Database Tracking**: Expired tokens are marked in the database
4. **Notifications**: Admin receives email notification about expired bookings

## Checking for Expired Bookings

### Manual Check

Run the script to check for expired bookings:

```bash
npm run check-expired-bookings
```

This will:
- List all expired bookings
- Send email notifications
- Show next steps

### API Endpoint

You can also check programmatically:

```bash
GET /api/bookings/check-expired
```

Returns:
```json
{
  "expiredCount": 2,
  "expiredBookings": [...]
}
```

## Email Notifications

When expired bookings are detected, an email is sent to the admin email (set in `ADMIN_EMAIL` environment variable or defaults to `admin@theauraesthetics.com`).

The email includes:
- Number of expired bookings
- Details for each booking (service, client, amount, payment status)
- Payment intent IDs for reference
- Next steps for action

## Handling Expired Bookings

### Option 1: Contact Client to Reschedule

1. Contact the client via email/phone
2. Explain the situation
3. Generate a new booking token
4. Send them the new booking link

### Option 2: Regenerate Token

Use the API to regenerate a token:

```bash
POST /api/bookings/regenerate-token
{
  "paymentIntentId": "pi_xxx",
  // OR
  "bookingId": "uuid-xxx"
}
```

Returns:
```json
{
  "success": true,
  "token": "new-token-xxx",
  "bookingUrl": "https://cal.com/auraesthetics/service?token=xxx",
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

### Option 3: Process Refund

If the client cancels or doesn't want to reschedule:

1. Go to Stripe Dashboard
2. Find the payment intent
3. Process a refund
4. Mark booking as cancelled in database

## Automated Monitoring

### Setting Up Cron Jobs

You can set up a cron job to check for expired bookings periodically:

```bash
# Check every hour
0 * * * * cd /path/to/project && npm run check-expired-bookings
```

Or use a service like:
- **Vercel Cron** (if deployed on Vercel)
- **GitHub Actions** (scheduled workflows)
- **External cron service** (cron-job.org, etc.)

### Vercel Cron Example

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/bookings/check-expired",
    "schedule": "0 * * * *"
  }]
}
```

## Environment Variables

Add to `.env.local`:

```env
# Admin email for expired booking notifications
ADMIN_EMAIL=your-email@example.com
```

## Admin Dashboard (Future)

A future admin dashboard will show:
- All expired bookings
- One-click token regeneration
- Direct links to Stripe payments
- Quick refund processing

## Best Practices

1. **Monitor Regularly**: Check for expired bookings daily
2. **Quick Response**: Contact clients within 24 hours
3. **Clear Communication**: Explain the situation clearly
4. **Flexible Options**: Offer rescheduling or refund
5. **Track Patterns**: If many tokens expire, consider:
   - Increasing token expiration time
   - Improving booking flow UX
   - Adding reminders

