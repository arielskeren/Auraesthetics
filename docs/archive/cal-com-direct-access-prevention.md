<!-- Archived 2025-11-16: Legacy Cal.com note; retained for historical reference -->

# Preventing Direct Cal.com Access Without Payment

## Problem

Even with token verification, users can still access Cal.com links directly (e.g., `https://cal.com/auraesthetics/lip-wax`) and create bookings without payment.

## Solutions Implemented

### 1. Require Manual Confirmation (Primary Protection)

**What it does:**
- All Cal.com bookings require manual confirmation
- Bookings don't auto-confirm
- You can review and approve only bookings with valid payments

**Setup:**
```bash
npm run require-cal-confirmation
```

**How it works:**
- Bookings are created as "Pending" status
- You review each booking in Cal.com dashboard
- Only approve bookings that have valid payment tokens
- Reject unauthorized bookings

### 2. Webhook Auto-Cancellation (Secondary Protection)

**What it does:**
- Webhook automatically cancels bookings without valid tokens
- Cancels bookings without valid payment
- Logs unauthorized booking attempts

**How it works:**
- When Cal.com creates a booking, webhook checks for token
- If no valid token → Booking is cancelled via Cal.com API
- Booking is marked as "cancelled" in database
- You receive notification (if configured)

### 3. Verification Page (Additional Layer)

**What it does:**
- Redirects users through verification page first
- Verifies token before allowing Cal.com access
- Prevents casual direct access

**Limitation:**
- Doesn't prevent determined users who know the URL
- But works for most users

## Recommended Workflow

### Daily Monitoring

1. **Check Cal.com Dashboard** → Bookings → Pending
2. **Verify Payment** → Check if booking has valid payment token
3. **Approve Valid Bookings** → Only bookings with valid payment
4. **Reject Unauthorized** → Bookings without payment

### Automated Actions

The webhook will automatically:
- ✅ Cancel bookings without valid tokens
- ✅ Mark them as "cancelled" in database
- ✅ Log unauthorized attempts

## Setup Instructions

### Step 1: Enable Require Confirmation

Run:
```bash
npm run require-cal-confirmation
```

This sets all Cal.com events to require manual confirmation.

### Step 2: Verify Settings

1. Go to Cal.com Dashboard → Event Types
2. Select any event type
3. Check "Require Confirmation" setting
4. Should be enabled

### Step 3: Test Unauthorized Booking

1. Try accessing Cal.com link directly (without payment)
2. Complete booking attempt
3. Check Cal.com dashboard - booking should be "Pending"
4. Check webhook logs - booking should be cancelled
5. Check database - booking should be marked as "cancelled"

## Manual Review Process

### When You See a Pending Booking

1. **Check Cal.com Booking** → Note the booking ID
2. **Check Database**:
   ```bash
   npm run view-bookings
   ```
3. **Verify Payment**:
   - Does booking have `payment_intent_id`?
   - Does booking have `bookingToken` in metadata?
   - Is token valid (not expired)?

### If Booking Has Valid Payment
- ✅ **Approve** in Cal.com dashboard
- Booking is confirmed

### If Booking Has No Payment
- ❌ **Reject** in Cal.com dashboard
- Or let webhook auto-cancel it
- Contact client to complete payment if needed

## Monitoring Unauthorized Bookings

### Check for Unauthorized Bookings

```sql
SELECT * FROM bookings 
WHERE payment_status = 'cancelled' 
AND metadata->>'unauthorized' = 'true'
ORDER BY created_at DESC;
```

### Email Notifications

You'll receive email notifications when:
- Token expires without booking
- Unauthorized booking attempts (if configured)

## Best Practices

1. **Review Daily**: Check pending bookings daily
2. **Verify Payment**: Always verify payment before approving
3. **Quick Response**: Approve valid bookings quickly for good UX
4. **Monitor Patterns**: If many unauthorized attempts, consider additional security

## Alternative: Make Events Private

If you want even more security, you can:
1. Make Cal.com events private (requires login)
2. But this adds friction for legitimate customers
3. Not recommended unless necessary

## Current Security Layers

1. ✅ **Verification Page** - Prevents casual direct access
2. ✅ **Token Verification** - Validates payment before booking
3. ✅ **Require Confirmation** - Manual approval required
4. ✅ **Auto-Cancellation** - Webhook cancels unauthorized bookings
5. ✅ **Database Tracking** - All attempts are logged

