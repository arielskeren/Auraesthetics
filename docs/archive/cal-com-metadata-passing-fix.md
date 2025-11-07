# Cal.com Metadata Passing Issue & Solution

## Problem

Cal.com does **NOT** automatically pass URL query parameters to webhooks. When we redirect to Cal.com with:
```
https://cal.com/auraesthetics/aura-facial?token=abc123&paymentIntentId=pi_xxx
```

The webhook receives the booking data, but **NOT** the query parameters (`token`, `paymentIntentId`, etc.).

## Why This Happens

Cal.com webhooks only include:
- Booking data from Cal.com's own booking form
- Data stored in Cal.com's booking record
- Metadata that was set via Cal.com's API or custom fields

URL query parameters are not included in webhook payloads.

## Current Solution (Fallback Matching)

The webhook now uses **three fallback methods** to match bookings:

### Method 1: Payment Intent ID + Token (Most Secure)
- Tries to match by both payment intent ID and booking token
- Only works if Cal.com somehow passes this data

### Method 2: Payment Intent ID Only (Fallback)
- If no token match, tries to match by payment intent ID only
- Looks for bookings with matching payment intent ID that don't have a Cal.com booking yet
- **Less secure** but more likely to work

### Method 3: Email Match (Last Resort)
- If no payment intent match, tries to match by client email
- Looks for recent bookings (within 2 hours) with matching email
- **Least secure** - should only be used as last resort

## Better Solution: Use Cal.com Custom Questions

To properly pass payment data to Cal.com, we should use **Custom Questions**:

### Step 1: Create Hidden Custom Questions in Cal.com

1. Go to Cal.com Dashboard → Settings → Event Types
2. Select each event type
3. Go to "Questions" section
4. Add a hidden question:
   - **Label:** "Payment Intent ID" (hidden from user)
   - **Type:** Text
   - **Required:** No
   - **Hidden:** Yes
   - **Placeholder:** Will be pre-filled

5. Repeat for:
   - Booking Token
   - Payment Type

### Step 2: Pre-fill Custom Questions via URL

Cal.com supports pre-filling questions via URL parameters:
```
https://cal.com/auraesthetics/aura-facial?paymentIntentId=pi_xxx&bookingToken=abc123
```

However, you need to configure the question field names to match the URL params.

### Step 3: Alternative - Use Cal.com API to Set Metadata

When the booking is created, we can use Cal.com's API to update the booking with metadata:

```typescript
// After booking is created, update it with metadata
await axios.patch(`https://api.cal.com/v1/bookings/${bookingId}`, {
  metadata: {
    paymentIntentId: 'pi_xxx',
    bookingToken: 'abc123',
  }
});
```

But this requires the booking to already exist.

## Recommended Solution: Manual Linking Tool

For now, the best approach is to use the **admin dashboard** to manually link bookings:

1. Find the booking in admin dashboard
2. Get the Cal.com booking ID from Cal.com dashboard
3. Use the "Link Cal.com Booking" feature (if we add it)
4. Or manually update via database

## Implementation Status

✅ **Completed:**
- Enhanced webhook logging to see what data is received
- Multiple fallback matching methods
- Better error handling and logging

⏳ **In Progress:**
- Manual linking tool in admin dashboard
- Better matching by email/timestamp

📋 **To Do:**
- Set up Cal.com custom questions (requires manual configuration)
- Or use Cal.com API to update bookings with metadata after creation

## Testing

To test the webhook:
1. Make a payment
2. Complete Cal.com booking
3. Check server logs for webhook data
4. Verify booking is matched correctly
5. Check admin dashboard to see if client info is populated

## Next Steps

1. **Immediate:** Check webhook logs to see what data Cal.com is sending
2. **Short-term:** Add manual linking tool in admin dashboard
3. **Long-term:** Set up Cal.com custom questions or use API to set metadata

