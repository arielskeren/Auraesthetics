# 50% Deposit Booking Flow (Draft)

## High-Level Sequence
1. **Client selects service** on auraesthetics.com.
2. **Availability fetch** (Cal API) shows the next 7 days with week navigation.
3. Client **chooses a slot** → we stage the selection locally (not yet booked).
4. **Payment modal opens** with two options:
   - `Deposit (50%)` – default
   - `Pay in full` – optional
5. On submit:
   - `/api/payments/create-intent` creates a Stripe Payment Intent for deposit amount (or full total).
   - Client completes payment with Stripe Elements.
6. After successful payment:
   - `/api/bookings/create-token` issues booking token, storing:
     ```json
     {
       "selectedSlot": "2025-11-15T18:00:00Z",
       "eventTypeId": 3815418,
       "depositAmount": 82.5,
       "balanceDue": 82.5,
       "paymentType": "deposit"
     }
     ```
   - Server stores outstanding balance metadata.
   - Client redirected to `/book/verify?token=...`.
7. `/book/verify` validates token, then **creates Cal.com booking via API**:
   ```json
   POST /v1/bookings
   {
     "eventTypeId": 3815418,
     "startTime": "2025-11-15T18:00:00Z",
     "attendees": [{ "name": "...", "email": "..." }],
     "requiresConfirmation": true,
     "metadata": {
       "paymentIntentId": "pi_123",
       "depositAmount": 82.5,
       "balanceDue": 82.5,
       "paymentType": "deposit",
       "bookingToken": "..."
     }
   }
   ```
8. Cal.com triggers `booking.created` webhook → we update Neon record:
   - `payment_status = 'deposit_paid'`
   - `cal_booking_id`, client info, slot, metadata
9. Admin dashboard shows deposit + balance due. Balance can be collected later via manual invoice or upcoming automation.

## Stripe Objects
- **Deposit**: Payment Intent with `amount = total * 0.5`, `capture_method = automatic`.
- **Full payment**: Payment Intent with `amount = total`.
- **Balance collection (later phase)**: options
  1. Create a new Payment Intent (or invoice) referencing original booking metadata.
  2. Capture a separate Payment Intent using saved payment method (if SCA-compliant).

## Token Lifecycle Updates
- Token stores `selectedSlot`, `eventTypeId`, `depositAmount`, `balanceDue`.
- Expires in 30 min if Cal booking not created; admin notified via existing expired-token job.
- Regenerating a token should maintain the same slot or prompt the user to pick a new slot (TBD).

## Error Handling
- If Cal booking creation fails (slot taken):
  - Redirect user back to availability panel with message to choose a different time.
  - Optionally offer refund or reuse same deposit (policy decision).
- If payment succeeds but slot is lost:
  - Token flagged `status: 'slot_unavailable'`.
  - Admin dashboard highlights booking for manual follow-up.

## Pending Decisions
- Whether to automatically confirm Cal booking after deposit or keep manual confirmation.
- Balance collection method (manual invoice vs. automated card-on-file capture).
- Grace period policy between deposit payment and appointment.

