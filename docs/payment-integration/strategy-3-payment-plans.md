# Payment System Integration - Strategy 3: Payment Plans & Deposits

## Overview
Allow clients to pay deposits upfront and complete payment later, or set up installment payment plans for services.

## Status
⏸️ **Deferred to Future Phase**

This strategy is planned but not included in Phase 1 implementation. Will be added after Phase 1 is complete.

---

## Payment Plans Options

### Option 1: Deposit + Remainder
- Client pays deposit upfront (e.g., 50%)
- Remainder due before service or at appointment
- Simple split payment approach

### Option 2: Installment Plans
- Multiple payments over time
- Example: 3 payments of $50 for $150 service
- Automatic recurring payments
- Payment schedule management

### Option 3: Monthly Payment Plans
- Set number of monthly payments
- Example: $50/month for 3 months
- Stripe Subscriptions integration
- Automatic billing

---

## Implementation Approach

### Deposit + Remainder Flow

**Step 1: Deposit Payment**
```typescript
// Create payment intent for deposit
const depositIntent = await stripe.paymentIntents.create({
  amount: depositAmount * 100,
  currency: 'usd',
  metadata: {
    type: 'deposit',
    serviceId,
    remainingAmount: (totalAmount - depositAmount) * 100
  }
});
```

**Step 2: Store Payment Plan**
```sql
INSERT INTO payment_plans (
  booking_id,
  total_amount,
  deposit_amount,
  remaining_amount,
  payment_status,
  due_date
) VALUES (...);
```

**Step 3: Remainder Payment**
- Send reminder email before appointment
- Create payment link for remainder
- Process payment before service

### Installment Plans Flow

**Step 1: Create Payment Schedule**
```typescript
// Create multiple payment intents
const payments = [
  { amount: 5000, dueDate: '2024-12-01' },
  { amount: 5000, dueDate: '2025-01-01' },
  { amount: 5000, dueDate: '2025-02-01' }
];

// Store payment schedule
for (const payment of payments) {
  await createScheduledPayment(bookingId, payment);
}
```

**Step 2: Automatic Payment Processing**
- Use Stripe Scheduled Payments
- Or cron job to process payments
- Send reminders before due date

### Monthly Payment Plans Flow

**Step 1: Create Subscription**
```typescript
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{
    price: priceId, // Stripe Price for monthly payment
  }],
  payment_behavior: 'default_incomplete',
  payment_settings: { save_default_payment_method: 'on_subscription' },
  expand: ['latest_invoice.payment_intent'],
});
```

**Step 2: Manage Subscription**
- Track subscription status
- Handle failed payments
- Cancel if needed

---

## Database Schema

```sql
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  plan_type VARCHAR(50), -- 'deposit', 'installment', 'subscription'
  total_amount DECIMAL(10, 2),
  deposit_amount DECIMAL(10, 2),
  remaining_amount DECIMAL(10, 2),
  payment_count INTEGER, -- Number of payments
  payment_frequency VARCHAR(50), -- 'monthly', 'weekly', 'one-time'
  status VARCHAR(50), -- 'active', 'completed', 'cancelled', 'failed'
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
  payment_status VARCHAR(50), -- 'pending', 'paid', 'failed', 'cancelled'
  payment_intent_id VARCHAR(255),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Routes Needed

### Create Payment Plan
`POST /api/payments/create-plan`
- Receive booking and plan details
- Create payment plan in database
- Set up Stripe subscription or payment intents
- Return plan confirmation

### Process Scheduled Payment
`POST /api/payments/process-scheduled`
- Process payment for scheduled date
- Update payment schedule
- Send confirmation email

### Update Payment Plan
`PATCH /api/payments/plans/:id`
- Update plan details
- Modify schedule
- Cancel if needed

### Get Payment Plan Status
`GET /api/payments/plans/:id`
- Return current plan status
- Show payment history
- Display upcoming payments

---

## Stripe Integration

### Stripe Subscriptions
- Use for recurring monthly payments
- Automatic billing
- Proration handling
- Cancellation support

### Stripe Payment Intents
- Use for one-time deposit payments
- Manual remainder collection
- Payment scheduling

### Stripe Invoices
- Generate invoices for each payment
- Email invoices to clients
- Track payment history

---

## Admin Dashboard Features

### Payment Plan Management
- View all active payment plans
- Filter by status
- See payment history
- Process manual payments
- Cancel plans if needed

### Payment Reminders
- Automatic email reminders before due date
- Failed payment notifications
- Overdue payment alerts

---

## Email Templates

### Deposit Confirmation
- Deposit amount paid
- Remaining balance
- Due date reminder
- Payment link for remainder

### Payment Reminder
- Upcoming payment due
- Amount due
- Payment link
- Grace period information

### Payment Failure Notification
- Failed payment details
- Retry payment link
- Contact information
- Alternative payment options

---

## User Experience Flow

### Deposit Flow
1. User selects service
2. Chooses "Pay Deposit" option
3. Enters payment information
4. Pays deposit amount
5. Receives confirmation with booking
6. Receives reminder before appointment
7. Pays remainder before service

### Installment Flow
1. User selects service
2. Chooses "Payment Plan" option
3. Selects number of payments
4. Enters payment information
5. First payment processed
6. Receives payment schedule
7. Automatic payments processed
8. Receives confirmation when complete

---

## Security Considerations

### Payment Verification
- Verify all payments before confirming booking
- Store payment method securely
- Use Stripe's secure payment methods

### Cancellation Policy
- Define cancellation terms
- Handle refunds for deposits
- Process cancellation fees if applicable

### Fraud Prevention
- Verify payment methods
- Monitor for suspicious activity
- Set payment limits

---

## Testing Checklist

- [ ] Create deposit payment plan
- [ ] Process deposit payment
- [ ] Send remainder payment reminder
- [ ] Process remainder payment
- [ ] Create installment plan
- [ ] Process scheduled payments
- [ ] Handle payment failures
- [ ] Cancel payment plan
- [ ] Process refunds
- [ ] Admin dashboard functionality

---

## Future Enhancements

- Flexible payment schedules
- Custom payment amounts
- Payment plan templates
- Automatic payment retry
- Payment plan analytics
- Integration with accounting systems

---

## Estimated Implementation Time

- **Database Schema**: 1-2 hours
- **API Routes**: 4-6 hours
- **Stripe Integration**: 3-4 hours
- **Admin Dashboard**: 3-4 hours
- **Email Templates**: 2-3 hours
- **Testing**: 3-4 hours

**Total**: 16-23 hours

---

## Notes

- Payment plans require careful handling of payment failures
- Consider grace periods for missed payments
- May need to integrate with accounting software
- Payment plan terms should be clearly communicated
- Consider legal requirements for payment plans

