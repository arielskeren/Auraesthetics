# Archived Stripe Integration

This directory contains the archived Stripe payment integration code. These files were moved here when the project transitioned from Stripe to MagicPay.

## Why Archived?

The project migrated to MagicPay for payment processing. The Stripe code is preserved here for:
- Historical reference
- Potential future reactivation if needed
- Understanding the previous payment flow

## Archived Files

### lib/
- `stripeClient.ts` - Stripe SDK initialization and helper functions
- `stripeSync.ts` - Service to Stripe product/price sync

### lib/bookings/
- `finalizeCore.ts` - Legacy booking finalization using Stripe PaymentIntents

### api/webhooks/stripe/
- `route.ts` - Stripe webhook handler for payment events

### api/payments/create-intent/
- `route.ts` - Stripe PaymentIntent creation endpoint

## Re-enabling Stripe

If you need to re-enable Stripe:

1. Move the relevant files back to their original locations
2. Add Stripe packages to package.json:
   ```json
   "@stripe/react-stripe-js": "^5.3.0",
   "@stripe/stripe-js": "^8.3.0",
   "stripe": "^19.3.0"
   ```
3. Add environment variables:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Update CustomPaymentModal.tsx to use Stripe Elements
5. Test thoroughly before deploying

## Migration Date

Archived: December 2024

## Notes

- Existing stripe_* columns in the database are preserved for historical transaction reference
- Historical bookings with `stripe_pi_id` values remain unchanged
- The MagicPay integration uses new `magicpay_*` columns

