# Payment System Integration Plans

This folder contains all planning documents and implementation guides for the Cal.com + Stripe payment integration system.

## Plans Overview

### Phase 1: Flow B (Custom Payment Popup) - CURRENT
**File**: `phase-1-flow-b.md`
- Custom payment modal component
- Stripe payment intents
- Plaid authorization for pay-later (50% hold)
- Discount codes via Stripe Coupons
- Neon database integration
- Brevo welcome email with discount codes

### Phase 2: Payment Plans (Future)
**File**: `phase-2-payment-plans.md`
- Recurring payment plans
- Installment options
- Monthly payment schedules

### Phase 3: Admin Booking (Future)
**File**: `phase-3-admin-booking.md`
- Admin booking interface
- Manual booking creation
- Client management

### Phase 4: Advanced Features (Future)
**File**: `phase-4-advanced.md`
- Refund management
- Cancellation policies
- Payment retry logic
- Advanced reporting

## Implementation Status

- [ ] Phase 1: Flow B - In Planning
- [ ] Phase 2: Payment Plans - Not Started
- [ ] Phase 3: Admin Booking - Not Started
- [ ] Phase 4: Advanced Features - Not Started

## Quick Reference

- **Database**: Neon PostgreSQL (free tier)
- **Payment Processing**: Stripe
- **Scheduling**: Cal.com
- **Email**: Brevo
- **Authorization**: Plaid (via Stripe)

## Cost Summary

- Cal.com: $0/month (free plan)
- Stripe: 2.9% + $0.30 per transaction
- Neon: $0/month (free tier)
- Brevo: Already integrated
- **Total Monthly**: $0/month (transaction fees only)

