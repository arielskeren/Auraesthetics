# Payment System Integration - Strategy 1: Hybrid Payment Flow

## Overview
Strategy 1 provides two payment flow options: Flow A (Cal.com native) and Flow B (Custom popup). Flow B is the primary implementation focus.

## Flow A: Cal.com Native (Existing)

### Description
Direct integration with Cal.com's built-in payment system. User clicks "Book Now" and is redirected or shown the Cal.com booking widget, which handles payment directly.

### Current Implementation
- ✅ Already integrated via `BookingModal.tsx`
- ✅ Uses Cal.com embed script
- ✅ Cal.com handles Stripe payments automatically

### Pros
- ✅ Simple, tested, works now
- ✅ No additional code needed
- ✅ Stripe integration handled by Cal.com
- ✅ Email confirmations automatic

### Cons
- ❌ No discount codes
- ❌ Fixed pricing (cannot customize)
- ❌ No payment plans
- ❌ No pay-later option
- ❌ Less control over payment flow

### When to Use
- Quick booking for standard services
- No discounts needed
- Simple payment flow preferred

---

## Flow B: Custom Payment Popup (Primary Implementation)

### Description
Custom payment modal that appears before Cal.com booking. Allows users to:
- Enter discount codes
- Choose payment method (full, deposit, pay-later)
- Customize payment amount
- Authorize payment holds

### Architecture
```
User clicks "Book Now"
    ↓
CustomPaymentModal opens
    ↓
User selects payment option
    ↓
Stripe/Plaid processes payment
    ↓
Cal.com booking opens with metadata
    ↓
Booking confirmed via webhook
```

### Features
- ✅ Discount code validation
- ✅ Payment method selection
- ✅ Deposit vs full payment
- ✅ Pay-later with authorization
- ✅ Stripe Payment Intents
- ✅ Plaid authorization for holds

### Implementation Status
- [ ] CustomPaymentModal component
- [ ] Stripe Elements integration
- [ ] Payment intent API
- [ ] Plaid authorization flow
- [ ] Cal.com metadata passing

### Pros
- ✅ Full control over payment flow
- ✅ Supports discount codes
- ✅ Flexible payment options
- ✅ Better user experience
- ✅ Custom branding

### Cons
- ❌ More complex implementation
- ❌ Requires additional API routes
- ❌ More moving parts to maintain

### When to Use
- Discount codes needed
- Custom payment options required
- Payment plans or deposits needed
- Maximum flexibility desired

---

## Choosing Between Flows

### Use Flow A When:
- Standard booking, no discounts
- Quick implementation needed
- Simple payment flow acceptable

### Use Flow B When:
- Discount codes needed
- Custom payment options required
- Deposits or pay-later needed
- Want full control

### Recommendation
**Primary**: Flow B (Custom Payment Popup)  
**Fallback**: Flow A (Cal.com Native) - Keep as option for simple bookings

---

## Implementation Details

### Flow A Integration
See existing `BookingModal.tsx` and `useCalEmbed.ts`

### Flow B Integration
See `docs/payment-integration/phase-1-flow-b.md`

---

## Future Enhancements

### Option: Flow Selection UI
Add toggle in BookingModal to let users choose:
- "Quick Book" → Flow A
- "Customize Payment" → Flow B

This provides flexibility while keeping Flow A as a simple option.

