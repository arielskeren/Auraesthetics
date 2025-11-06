# Payment System Integration - Strategy 4: Skip Payment (Manual Approval)

## Overview
Allow clients to skip payment during booking and pay later via cash, Zelle, or other manual payment methods. Requires payment authorization hold for cancellation protection.

## Status
✅ **Integrated into Phase 1 Flow B**

This strategy is implemented as part of the "Pay Later" option in Flow B, with Plaid authorization for 50% hold.

---

## Requirements

### Authorization Hold
- **Amount**: 50% of service price
- **Purpose**: Cancellation protection
- **Method**: Plaid authorization via Stripe
- **Duration**: Until payment completed or booking cancelled
- **Release**: Automatic release after payment or cancellation

### Payment Methods Acceptable
- Cash (in-person)
- Zelle (bank transfer)
- Venmo (if desired)
- Check (if desired)
- Other manual payment methods

---

## Implementation Flow

### Step 1: Client Selects "Pay Later"
```typescript
// In CustomPaymentModal
const paymentType = 'pay-later';
```

### Step 2: Plaid Authorization Required
```typescript
// User must authorize payment method
// Create Setup Intent for authorization hold
const setupIntent = await stripe.setupIntents.create({
  payment_method_types: ['card'],
  customer: customerId,
  metadata: {
    type: 'authorization',
    serviceId,
    authorizationAmount: baseAmount * 0.5 // 50%
  }
});
```

### Step 3: Authorize 50% Hold
```typescript
// Create Payment Intent with manual capture
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(baseAmount * 0.5 * 100), // 50% in cents
  currency: 'usd',
  capture_method: 'manual', // Authorization only, don't capture
  payment_method: paymentMethodId,
  confirm: true,
  metadata: {
    type: 'authorization',
    serviceId,
    bookingId
  }
});
```

### Step 4: Store Authorization
```sql
INSERT INTO bookings (
  ...,
  payment_status,
  plaid_authorization_id,
  plaid_authorization_amount
) VALUES (
  ...,
  'authorized',
  paymentIntent.id,
  paymentIntent.amount
);
```

### Step 5: Complete Booking
- Booking proceeds to Cal.com
- No payment collected yet
- Authorization hold active
- Booking confirmed

### Step 6: Manual Payment Processing
- Client pays via cash/Zelle/etc.
- Admin marks payment as received
- Authorization hold released
- Booking status updated

---

## Database Schema

The authorization is stored in the `bookings` table:

```sql
-- Already included in Phase 1 schema
plaid_authorization_id VARCHAR(255),
plaid_authorization_amount DECIMAL(10, 2),
payment_status VARCHAR(50), -- 'authorized' for pay-later bookings
```

---

## API Routes

### Create Authorization
**File**: `app/api/payments/plaid-authorize/route.ts`

```typescript
export async function POST(request: Request) {
  const { serviceId, amount, paymentMethodId } = await request.json();
  
  // Create authorization hold for 50%
  const authorizationAmount = amount * 0.5;
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(authorizationAmount * 100),
    currency: 'usd',
    capture_method: 'manual',
    payment_method: paymentMethodId,
    confirm: true,
    metadata: {
      type: 'authorization',
      serviceId,
      authorizationAmount: authorizationAmount.toString()
    }
  });
  
  return Response.json({
    success: true,
    authorizationId: paymentIntent.id,
    authorizationAmount: authorizationAmount
  });
}
```

### Release Authorization
**File**: `app/api/payments/release-authorization/route.ts`

```typescript
export async function POST(request: Request) {
  const { authorizationId, bookingId } = await request.json();
  
  // Cancel the authorization (release hold)
  await stripe.paymentIntents.cancel(authorizationId);
  
  // Update booking status
  await db.query(
    'UPDATE bookings SET payment_status = $1 WHERE id = $2',
    ['paid', bookingId]
  );
  
  return Response.json({ success: true });
}
```

### Capture Authorization (If Needed)
**File**: `app/api/payments/capture-authorization/route.ts`

```typescript
export async function POST(request: Request) {
  const { authorizationId, amount } = await request.json();
  
  // Capture the authorized amount
  await stripe.paymentIntents.capture(authorizationId, {
    amount_to_capture: amount * 100
  });
  
  return Response.json({ success: true });
}
```

---

## Admin Dashboard Integration

### Payment Status Display
```typescript
// Show bookings with 'authorized' status
const authorizedBookings = bookings.filter(
  b => b.payment_status === 'authorized'
);
```

### Manual Payment Marking
```typescript
// Admin marks payment as received
const markPaymentReceived = async (bookingId: string) => {
  // Release authorization hold
  await releaseAuthorization(booking.authorizationId);
  
  // Update booking status
  await updateBookingStatus(bookingId, 'paid');
  
  // Send confirmation email
  await sendPaymentConfirmation(booking.clientEmail);
};
```

---

## Cancellation Handling

### Authorized Booking Cancellation

**Scenario 1: Client Cancels Before Service**
```typescript
// Cancel booking
// Release authorization hold (no charge)
await stripe.paymentIntents.cancel(authorizationId);
await updateBookingStatus(bookingId, 'cancelled');
```

**Scenario 2: Client No-Shows**
```typescript
// No-show policy: capture authorization
await stripe.paymentIntents.capture(authorizationId);
await updateBookingStatus(bookingId, 'no-show');
```

**Scenario 3: Client Cancels Last Minute (< 24 hours)**
```typescript
// Late cancellation: capture 50% hold
await stripe.paymentIntents.capture(authorizationId);
await updateBookingStatus(bookingId, 'cancelled-late');
```

---

## Email Notifications

### Authorization Confirmation
```
Subject: Booking Confirmed - Payment Authorization Hold

Your appointment is confirmed!
We've placed a temporary authorization hold of $XX.XX (50% of service fee) 
for cancellation protection.

Remaining balance: $XX.XX
Payment due: At appointment (Cash or Zelle accepted)

This authorization will be released once payment is complete.
```

### Payment Reminder
```
Subject: Reminder: Payment Due for Your Appointment

Your appointment is scheduled for [DATE].
Payment method: Cash or Zelle

Amount due: $XX.XX
Authorized amount: $XX.XX (will be released upon payment)
```

### Authorization Release Confirmation
```
Subject: Authorization Released - Payment Confirmed

Your payment has been received and the authorization hold has been released.
Thank you for your payment!
```

---

## User Experience Flow

### Client Side
1. Select service
2. Choose "Pay Later" option
3. Enter payment method for authorization
4. Authorize 50% hold
5. Complete booking
6. Receive confirmation email
7. Pay at appointment (cash/Zelle)
8. Authorization released automatically

### Admin Side
1. View booking with "authorized" status
2. Collect payment at appointment
3. Mark payment as received
4. System releases authorization
5. Booking status updated to "paid"

---

## Security & Compliance

### Authorization Limits
- Clear communication of authorization amount
- Explicit consent required
- Authorization terms displayed

### Payment Verification
- Verify payment received before releasing hold
- Keep records of manual payments
- Track payment methods

### Cancellation Policy
- Clearly communicate cancellation terms
- Define late cancellation policy
- Handle no-show scenarios

---

## Stripe Integration Details

### Authorization vs Capture
- **Authorization**: Hold funds, don't charge
- **Capture**: Charge the authorized amount
- **Cancel**: Release the hold without charging

### Authorization Expiry
- Stripe authorizations expire after 7 days
- May need to refresh if booking is far in future
- Consider timing of authorization

### Payment Method Retention
- Store payment method securely
- Use Stripe Payment Methods API
- Can reuse for future bookings

---

## Edge Cases

### Authorization Expires Before Service
```typescript
// Refresh authorization if needed
if (authorizationExpiresBeforeService) {
  await refreshAuthorization(bookingId);
}
```

### Client Pays Before Appointment
```typescript
// Early payment: capture authorization + remainder
if (earlyPayment) {
  await captureAuthorization(authorizationId);
  await processRemainderPayment(bookingId);
}
```

### Multiple Authorization Attempts
```typescript
// Handle failed authorization
if (authorizationFails) {
  // Cancel previous attempt
  await cancelPreviousAuthorization();
  // Request new authorization
  await createNewAuthorization();
}
```

---

## Testing Checklist

- [ ] Create pay-later booking
- [ ] Authorize 50% hold
- [ ] Verify authorization stored
- [ ] Complete booking
- [ ] Receive confirmation email
- [ ] Mark payment as received
- [ ] Release authorization
- [ ] Test cancellation scenarios
- [ ] Test no-show scenario
- [ ] Test late cancellation
- [ ] Verify authorization expiry handling

---

## Notes

- Authorization hold provides cancellation protection
- Client must provide payment method for authorization
- Can use Stripe's built-in Plaid support or direct Plaid
- Authorization automatically expires after 7 days
- May need to refresh for bookings far in future
- Clear communication of authorization terms is crucial

