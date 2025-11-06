# Payment System Integration - Phase 4: Advanced Features

## Overview
Advanced features for payment system including refunds, cancellation policies, payment retry logic, and advanced reporting.

## Status
⏸️ **Future Phase**

This phase will be implemented after Phase 1-3 are complete.

---

## Features

### Refund Management
- ✅ Full refunds
- ✅ Partial refunds
- ✅ Refund reasons
- ✅ Refund approval workflow
- ✅ Automatic refunds for cancellations

### Cancellation Policies
- ✅ Time-based cancellation rules
- ✅ Cancellation fees
- ✅ No-show handling
- ✅ Late cancellation penalties
- ✅ Refund policy enforcement

### Payment Retry Logic
- ✅ Automatic retry for failed payments
- ✅ Retry schedule configuration
- ✅ Retry limit management
- ✅ Email notifications for retries
- ✅ Manual retry options

### Advanced Reporting
- ✅ Revenue analytics
- ✅ Payment method breakdown
- ✅ Refund tracking
- ✅ Cancellation rate analysis
- ✅ Discount code effectiveness
- ✅ Customer payment history

---

## Refund Management

### Refund Types

**Full Refund**
- Cancel booking before service
- Return full payment amount
- Process via Stripe

**Partial Refund**
- Cancel booking with fees
- Return partial amount
- Calculate refund amount

**Authorization Release**
- Release payment hold
- No actual refund needed
- Cancel authorization

### Refund Workflow

```typescript
const processRefund = async (bookingId: string, refundType: string) => {
  const booking = await getBooking(bookingId);
  
  let refundAmount = 0;
  
  if (refundType === 'full') {
    refundAmount = booking.paymentAmount;
  } else if (refundType === 'partial') {
    refundAmount = calculatePartialRefund(booking);
  }
  
  // Process refund via Stripe
  const refund = await stripe.refunds.create({
    payment_intent: booking.paymentIntentId,
    amount: refundAmount * 100,
    reason: 'requested_by_customer'
  });
  
  // Update booking status
  await updateBookingStatus(bookingId, 'refunded');
  
  // Send confirmation email
  await sendRefundConfirmation(booking.clientEmail, refundAmount);
  
  return refund;
};
```

---

## Cancellation Policies

### Policy Rules

**Standard Cancellation**
- Cancel > 48 hours before: Full refund
- Cancel 24-48 hours before: 50% refund
- Cancel < 24 hours before: No refund

**No-Show Policy**
- No-show: Capture authorization hold
- No refund for no-shows
- Reschedule option available

**Late Cancellation**
- Cancel < 24 hours: Cancellation fee applies
- Fee: 50% of service cost
- Process via authorization hold

### Implementation

```typescript
const calculateCancellationRefund = (booking: Booking, cancellationTime: Date) => {
  const hoursUntilService = hoursBetween(cancellationTime, booking.serviceDate);
  
  if (hoursUntilService > 48) {
    return { type: 'full', amount: booking.paymentAmount };
  } else if (hoursUntilService > 24) {
    return { type: 'partial', amount: booking.paymentAmount * 0.5 };
  } else {
    return { type: 'none', amount: 0 };
  }
};
```

---

## Payment Retry Logic

### Retry Configuration

```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,
  retryIntervals: [1, 3, 7], // days
  retryMethods: ['card', 'payment_method']
};
```

### Retry Workflow

```typescript
const retryFailedPayment = async (paymentIntentId: string, attempt: number) => {
  if (attempt > RETRY_CONFIG.maxAttempts) {
    // Mark as failed
    await markPaymentFailed(paymentIntentId);
    await sendPaymentFailureNotification(paymentIntentId);
    return;
  }
  
  // Wait for retry interval
  const daysToWait = RETRY_CONFIG.retryIntervals[attempt - 1];
  await scheduleRetry(paymentIntentId, daysToWait);
  
  // On retry date, attempt payment
  await attemptPaymentRetry(paymentIntentId);
};
```

---

## Advanced Reporting

### Revenue Analytics

```typescript
const getRevenueAnalytics = async (startDate: Date, endDate: Date) => {
  const bookings = await getBookingsByDateRange(startDate, endDate);
  
  return {
    totalRevenue: calculateTotalRevenue(bookings),
    totalBookings: bookings.length,
    averageBookingValue: calculateAverage(bookings),
    revenueByService: groupByService(bookings),
    revenueByPaymentMethod: groupByPaymentMethod(bookings),
    discountCodeUsage: calculateDiscountUsage(bookings),
    refundAmount: calculateRefunds(bookings)
  };
};
```

### Payment Method Breakdown

```typescript
const getPaymentMethodBreakdown = async () => {
  return {
    card: countByPaymentMethod('card'),
    cash: countByPaymentMethod('cash'),
    zelle: countByPaymentMethod('zelle'),
    deposit: countByPaymentMethod('deposit'),
    payLater: countByPaymentMethod('authorized')
  };
};
```

---

## Database Schema

### Refunds Table
```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  refund_type VARCHAR(50), -- 'full', 'partial'
  refund_amount DECIMAL(10, 2),
  refund_reason TEXT,
  stripe_refund_id VARCHAR(255),
  status VARCHAR(50), -- 'pending', 'completed', 'failed'
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Cancellations Table
```sql
CREATE TABLE cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  cancellation_reason TEXT,
  cancellation_type VARCHAR(50), -- 'client', 'admin', 'no-show'
  refund_amount DECIMAL(10, 2),
  cancellation_fee DECIMAL(10, 2),
  cancelled_at TIMESTAMP DEFAULT NOW()
);
```

### Payment Retries Table
```sql
CREATE TABLE payment_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id VARCHAR(255),
  booking_id UUID REFERENCES bookings(id),
  attempt_number INTEGER,
  retry_date DATE,
  status VARCHAR(50), -- 'scheduled', 'success', 'failed'
  next_retry_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Routes

### Process Refund
`POST /api/payments/refund`

### Cancel Booking
`POST /api/bookings/:id/cancel`

### Retry Payment
`POST /api/payments/retry`

### Get Analytics
`GET /api/analytics/revenue`

### Get Reports
`GET /api/reports/:type`

---

## Admin Dashboard Features

### Refund Management
- View pending refunds
- Approve/reject refunds
- Process refunds
- Refund history

### Cancellation Management
- View cancellations
- Apply cancellation policies
- Process refunds
- Track cancellation reasons

### Payment Retry Management
- View scheduled retries
- Manually trigger retries
- Cancel retries
- Retry history

### Reporting Dashboard
- Revenue charts
- Payment method breakdown
- Service performance
- Discount code effectiveness
- Refund analysis

---

## Email Templates

### Refund Confirmation
- Refund amount
- Refund method
- Processing time
- Next steps

### Cancellation Notification
- Cancellation confirmed
- Refund amount (if applicable)
- Cancellation fee (if applicable)
- Reschedule option

### Payment Retry Notification
- Payment failed
- Retry scheduled
- Retry date
- Update payment method link

---

## Testing Checklist

- [ ] Process full refund
- [ ] Process partial refund
- [ ] Release authorization
- [ ] Test cancellation policies
- [ ] Test no-show handling
- [ ] Test late cancellation
- [ ] Test payment retry logic
- [ ] Test retry scheduling
- [ ] Generate revenue reports
- [ ] Test analytics dashboard

---

## Estimated Timeline

- Refund Management: 4-6 hours
- Cancellation Policies: 3-4 hours
- Payment Retry Logic: 4-5 hours
- Advanced Reporting: 5-7 hours
- Testing: 4-5 hours

**Total**: 20-27 hours

---

## Future Enhancements

- Automated refund approval
- Advanced cancellation workflows
- Custom retry schedules
- Export reports to CSV/PDF
- Integration with accounting software
- Tax reporting
- Compliance reporting

---

## Notes

- Refunds require careful handling and approval
- Cancellation policies should be clearly communicated
- Payment retries help recover failed payments
- Reporting provides valuable business insights
- Consider integration with accounting systems

