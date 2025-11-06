# Payment System Integration Plans

This folder contains all planning documents and implementation guides for the Cal.com + Stripe payment integration system.

## Plans Overview

### Strategies

#### Strategy 1: Hybrid Payment Flow
**File**: `strategy-1-hybrid-payment-flow.md`
- Flow A: Cal.com Native (existing)
- Flow B: Custom Payment Popup (primary implementation)
- Choose between flows based on needs

#### Strategy 2: Discount Codes
**File**: `strategy-2-discount-codes.md`
- Stripe Coupons integration
- Discount validation API
- Automatic discount application

#### Strategy 3: Payment Plans & Deposits
**File**: `strategy-3-payment-plans.md`
- Deposit + Remainder payments
- Installment plans
- Monthly payment plans

#### Strategy 4: Skip Payment (Manual Approval)
**File**: `strategy-4-skip-payment.md`
- Pay Later option
- Plaid authorization (50% hold)
- Manual payment processing

#### Strategy 5: Admin Booking Flow
**File**: `strategy-5-admin-booking.md`
- Admin booking interface
- Client booking management
- Payment override capabilities

### Phases

#### Phase 1: Flow B (Custom Payment Popup) - CURRENT
**File**: `phase-1-flow-b.md`
- Custom payment modal component
- Stripe payment intents
- Plaid authorization for pay-later (50% hold)
- Discount codes via Stripe Coupons
- Neon database integration
- Brevo welcome email with discount codes

#### Phase 2: Payment Plans (Future)
**File**: `phase-2-payment-plans.md`
- Recurring payment plans
- Installment options
- Monthly payment schedules

#### Phase 3: Admin Booking (Future)
**File**: `phase-3-admin-booking.md`
- Admin booking interface
- Manual booking creation
- Client management

#### Phase 4: Advanced Features (Future)
**File**: `phase-4-advanced-features.md`
- Refund management
- Cancellation policies
- Payment retry logic
- Advanced reporting

## Implementation Status

### Strategies
- [x] Strategy 1: Hybrid Payment Flow - Documented
- [x] Strategy 2: Discount Codes - Documented
- [x] Strategy 3: Payment Plans - Documented
- [x] Strategy 4: Skip Payment - Documented
- [x] Strategy 5: Admin Booking - Documented

### Phases
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

