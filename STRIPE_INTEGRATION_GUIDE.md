# Stripe Integration with Cal.com - Status & Guide

## ✅ Current Status

**All events have pricing configured!** However, the prices need to be corrected.

### Issue Found
- All 18 events have pricing set in Cal.com
- But prices are stored incorrectly (e.g., $1.50 instead of $150)
- This happened because the API was sending dollar amounts instead of cents

### Cal.com API Requirements
- Cal.com stores prices in **cents** (not dollars)
- $150 should be sent as `15000` (150 × 100)
- The API will then display it as $150

## 🔧 How to Fix

### Option 1: Update via API Script (Recommended)

Run the update script which now correctly converts prices to cents:

```bash
npm run update-cal-events
```

This will:
- ✅ Update all 18 events with correct pricing
- ✅ Respect 3 concurrent API calls with 4-second delays
- ✅ Convert prices from dollars to cents automatically

### Option 2: Manual Update in Cal.com UI

1. Go to https://cal.com
2. Navigate to **Event Types**
3. For each event, click to edit
4. Update the price to the correct dollar amount
5. Save

## 🔗 Connecting Stripe to Cal.com

### Step 1: Verify Stripe is Connected

1. Go to https://cal.com/settings/apps
2. Look for **Stripe** in the list of apps
3. If you see "Stripe" but it's not connected:
   - Click on **Stripe**
   - Click **Install** or **Connect**
   - You'll be redirected to Stripe to authorize
   - Complete the OAuth flow
4. Verify it shows as **"Connected"** or **"Installed"**

### Step 2: Verify Stripe Connection Works

Once Stripe is connected and prices are corrected:

1. Go to any event type in Cal.com
2. Make sure the event has a price set (not $0)
3. Try making a test booking
4. You should see the Stripe payment form during booking

## 📋 Verification Checklist

Run these commands to verify everything:

```bash
# 1. Check if Stripe is configured
npm run check-stripe

# 2. Verify all events exist
npm run verify-cal-events

# 3. Update pricing if needed
npm run update-cal-events
```

## 💳 Stripe Account Requirements

Make sure your Stripe account is:

- ✅ **Activated** - Complete business verification
- ✅ **In Live Mode** (or Test Mode for testing)
- ✅ **Connected to Cal.com** - Via Settings → Apps → Stripe

## 🧪 Testing Stripe Integration

### Test Mode
1. Use Stripe test cards: https://stripe.com/docs/testing
2. Test card: `4242 4242 4242 4242`
3. Any future expiry date
4. Any 3-digit CVC

### Live Mode
1. Make sure Stripe account is fully activated
2. Use real payment methods
3. Test with small amounts first

## 📊 Current Pricing (to be updated)

Based on `services.json`, here are the correct prices:

**Facials:**
- The Aura Facial: $150
- Anti-aging Facial: $165
- HydraFacial: $135
- Glass Skin Facial: $155
- Signature Detox Facial: $135
- Lymphatic Drainage Facial: $145

**Advanced:**
- Dermaplaning: $60
- Biorepeel: $230
- Microneedling: $170
- LED Light Therapy: $25
- Oxygen Peel: $130

**Brows & Lashes:**
- Brow Lamination: $80
- Brow Tint: $20
- Brow Wax & Tint: $35
- Lash Lift & Tint: $80
- Brow Lamination & Lash Lift Combo: $160

**Waxing:**
- Brow Wax: $20
- Lip Wax: $10

## 🚀 Next Steps

1. **Run the update script** to fix pricing:
   ```bash
   npm run update-cal-events
   ```

2. **Verify Stripe is connected** in Cal.com:
   - Go to https://cal.com/settings/apps
   - Check Stripe shows as "Connected"

3. **Test a booking**:
   - Go to any service booking page
   - Complete a test booking
   - Verify payment form appears

4. **Check Stripe dashboard**:
   - Go to https://dashboard.stripe.com
   - Verify test payments are appearing

## ✅ Success Indicators

You'll know Stripe is working when:
- ✅ Stripe shows as "Connected" in Cal.com Settings → Apps
- ✅ All events have correct pricing (not $1.50, but $150)
- ✅ Booking flow shows Stripe payment form
- ✅ Test payments appear in Stripe dashboard
- ✅ Payment confirmation emails are sent

## 🆘 Troubleshooting

**Stripe not showing in Cal.com:**
- Make sure you've installed the Stripe app
- Check Cal.com → Settings → Apps → Stripe

**Prices still wrong:**
- Run `npm run update-cal-events` again
- The script now correctly converts to cents

**Payment form not appearing:**
- Verify event has price > $0
- Check Stripe is connected
- Try clearing browser cache

**Need help?**
- Cal.com Docs: https://docs.cal.com/integrations/payments/stripe
- Stripe Docs: https://stripe.com/docs/payments

