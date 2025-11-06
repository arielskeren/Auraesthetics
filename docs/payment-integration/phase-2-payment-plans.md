# Payment System Integration - Phase 2: Payment Plans

## Overview
Implement payment plan options allowing clients to pay in installments or split payments over time.

## Status
⏸️ **Future Phase**

This phase will be implemented after Phase 1 is complete.

---

## Features

### Payment Plan Options
- ✅ Deposit + Remainder
- ✅ Installment Plans (2-4 payments)
- ✅ Monthly Payment Plans
- ✅ Custom payment schedules

### Payment Methods
- Stripe Payment Intents (one-time)
- Stripe Subscriptions (recurring)
- Automatic payment processing
- Manual payment tracking

---

## Implementation Details

See `docs/payment-integration/strategy-3-payment-plans.md` for complete implementation guide.

---

## Database Schema

```sql
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  plan_type VARCHAR(50),
  total_amount DECIMAL(10, 2),
  deposit_amount DECIMAL(10, 2),
  remaining_amount DECIMAL(10, 2),
  payment_count INTEGER,
  payment_frequency VARCHAR(50),
  status VARCHAR(50),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID REFERENCES payment_plans(id),
  payment_number INTEGER,
  amount DECIMAL(10, 2),
  due_date DATE,
  payment_status VARCHAR(50),
  payment_intent_id VARCHAR(255),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Routes

### Create Payment Plan
`POST /api/payments/create-plan`

### Process Scheduled Payment
`POST /api/payments/process-scheduled`

### Update Payment Plan
`PATCH /api/payments/plans/:id`

### Get Payment Plan Status
`GET /api/payments/plans/:id`

---

## Estimated Timeline

- Database Schema: 1-2 hours
- API Routes: 4-6 hours
- Stripe Integration: 3-4 hours
- Admin Dashboard: 3-4 hours
- Email Templates: 2-3 hours
- Testing: 3-4 hours

**Total**: 16-23 hours

---

## Dependencies

- Stripe Subscriptions (for recurring payments)
- Payment scheduling system
- Email reminder system
- Payment retry logic

---

## Notes

- Payment plans require careful handling of payment failures
- Consider grace periods for missed payments
- May need to integrate with accounting software
- Payment plan terms should be clearly communicated

