<!-- Archived 2025-11-16: Legacy Cal.com note; retained for historical reference -->

# Disconnecting Stripe from Cal.com

## Why Disconnect?

Even with prices set to $0, Cal.com may still show payment forms if Stripe is connected. Since we're handling all payments on our site first, we need to disconnect Stripe from Cal.com.

## Steps to Disconnect Stripe

### Option 1: Remove Stripe App (Recommended)

1. Go to **Cal.com Dashboard** → **Settings** → **Apps**
2. Find **Stripe** in the list
3. Click on **Stripe**
4. Click **Uninstall** or **Disconnect**
5. Confirm the disconnection

### Option 2: Disable Payment Collection per Event

If you want to keep Stripe connected but disable payment:

1. Go to **Cal.com Dashboard** → **Event Types**
2. For each event type:
   - Click on the event
   - Scroll to **Payment** section
   - Set price to **$0** (already done)
   - Look for **"Require payment"** or **"Collect payment"** toggle
   - **Turn OFF** payment collection
   - Save

### Option 3: Global Payment Settings

1. Go to **Cal.com Dashboard** → **Settings** → **Payment**
2. If there's a global toggle for payment collection, disable it
3. Or remove Stripe as the payment provider

## After Disconnecting

1. **Test the booking flow**:
   - Complete payment on your site
   - Redirect to Cal.com
   - Verify no payment form appears
   - Complete booking

2. **Verify in Cal.com**:
   - Go to any event type
   - Check that payment is disabled
   - Booking should be free ($0)

## Important Notes

- **Disconnecting Stripe from Cal.com** does NOT affect your Stripe account
- **Your Stripe integration** on your site will continue to work
- **Cal.com will only handle scheduling**, not payments
- **This is the correct setup** for your payment flow

## If Payment Still Appears

If Cal.com still shows payment after disconnecting:

1. Clear your browser cache
2. Try incognito/private browsing mode
3. Check if there's a cached version of the booking page
4. Verify the event type settings again
5. Check if there are any Cal.com subscription settings that require payment

## Recommended Setup

✅ **Your Site**: Handles all payments (Stripe)
✅ **Cal.com**: Only handles scheduling (no payment)
✅ **Flow**: Payment → Token → Redirect to Cal.com → Free booking

