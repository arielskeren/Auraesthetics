# Cal.com Availability + 50% Deposit Feasibility

## Summary
- ✅ Cal.com API exposes event types (`GET /v1/event-types`) and live availability (`GET /v1/availability`), so we can render slots inside auraesthetics.com before payment.
- ✅ Event types can stay at `$0` (as confirmed by API response) while still requiring manual confirmation, enabling us to collect deposits externally via Stripe.
- ✅ Metadata support lets us attach `paymentIntentId`, `depositAmount`, and `balanceDue` for downstream reconciliation.
- ⚠️ Cal.com does **not** natively manage partial payments; Auraesthetics must remain the source of truth for deposits/balances.
- 🪤 Fallback: If Cal.com API limits or downtime become blockers, Calendly (paid tiers) or Square Appointments offer embedded availability with built-in deposits, but would require retooling all existing webhooks/admin logic.

## Key Capabilities Confirmed
1. **Event Type Fetch**
   - Endpoint: `GET https://api.cal.com/v1/event-types`
   - Response includes `id`, `slug`, `requiresConfirmation`, `price`, etc.
   - Script: `npm run fetch-cal-event-types` produces `docs/cal-event-types.json`

2. **Availability Window**
   - Endpoint: `GET https://api.cal.com/v1/availability`
   - Supports `startTime`, `endTime`, `eventTypeId`, `timezone`
   - Enables a 7-day window UI with week navigation

3. **Booking Creation & Metadata**
   - Endpoint: `POST https://api.cal.com/v1/bookings`
   - Accepts `metadata` (JSON) stored alongside the booking
   - Webhooks (`booking.created`, `booking.updated`) deliver metadata and attendee details

4. **Manual Confirmation Flow**
   - Event setting `requiresConfirmation: true` keeps bookings pending until deposit is verified
   - Aligns with deposit-first workflow

## Recommended Flow
1. Fetch availability for selected service (default: next 7 days).
2. Client picks slot → Continue to deposit payment modal.
3. After successful 50% deposit, create booking via Cal API with metadata:
   ```json
   {
     "metadata": {
       "depositAmount": 82.50,
       "balanceDue": 82.50,
       "paymentIntentId": "pi_123",
       "token": "abcd"
     }
   }
   ```
4. Webhook reconciliation updates Neon DB + admin dashboard.
5. Admin confirms booking or triggers balance reminder.

## Fallback Considerations
- **Calendly (Pro plan)**: Native deposit support via Stripe but lacks granular metadata/webhook richness; migration effort is high.
- **Square Appointments**: Includes deposits and POS integration, but requires rebuilding customer experience and API integration.
- At present, Cal.com remains the preferred solution given existing infrastructure and confirmed API capabilities.

## Next Steps
- Use `docs/cal-event-types.json` as the source of truth for service → eventType mapping.
- Implement availability fetch component with 7-day view + week navigation.
- Continue work on deposit-first payment + booking flow per updated plan.

