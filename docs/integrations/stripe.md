# Stripe Integration Guide

## Current Status

✅ All Cal.com events have pricing configured  
⚠️ Prices stored in cents (not dollars) - API handles conversion

## Setup

### 1. Stripe Account
- Sign up at https://stripe.com
- Complete business verification
- Activate account

### 2. Connect to Cal.com
- Cal.com → Settings → Apps → Stripe → Install
- Complete OAuth flow
- Verify as "Connected"

### 3. API Keys
Add to `.env.local`:
```env
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Pricing

Cal.com stores prices in **cents**. Scripts automatically convert:
- $150 → 15000 cents
- API displays as $150

## Testing

### Test Mode
- Test card: `4242 4242 4242 4242`
- Any future expiry, any CVC
- See payments in Stripe test dashboard

### Verification
```bash
npm run check-stripe          # Check Stripe configuration
npm run verify-cal-events     # Verify events exist
npm run update-cal-events     # Update pricing
```

## Custom Payment Integration

See `docs/payment-integration/phase-1-flow-b.md` for:
- Custom payment intents
- Discount codes (Stripe Coupons)
- Payment plans
- Pay-later authorization

## Troubleshooting

**Stripe not showing in Cal.com:**
- Verify app is installed in Settings → Apps
- Re-authenticate if needed

**Payment form not appearing:**
- Verify event has price > $0
- Check Stripe connection status
- Clear browser cache

