# Cal.com Event Name Customization

## Overview
You want to customize calendar event names to include:
- Event type (service name)
- Client name
- Payment type (full or deposit)

Format: `[Event Type] - [Client Name] - [Payment Type]`

## Implementation Options

### Option 1: Webhook-Based Customization (Recommended)

Cal.com webhooks can be used to modify booking titles after creation. Update the booking title via the Cal.com API when the `BOOKING_CREATED` webhook is received.

**Implementation:**

1. In your Cal.com webhook handler (`app/api/webhooks/cal-com/route.ts`), after verifying the booking:

```typescript
// After booking is created and verified
if (webhook.triggerEvent === 'BOOKING_CREATED') {
  const booking = webhook.payload;
  
  // Extract client name and payment type from metadata
  const clientName = booking.attendees[0]?.name || 'Client';
  const paymentType = booking.metadata?.paymentType || 'full';
  const paymentTypeLabel = {
    'full': 'Full Payment',
    'deposit': '50% Deposit'
  }[paymentType] || 'Full Payment';
  
  // Format: [Event Type] - [Client Name] - [Payment Type]
  const newTitle = `${booking.eventType.title} - ${clientName} - ${paymentTypeLabel}`;
  
  // Update booking title via Cal.com API
  try {
    await axios.patch(
      `https://api.cal.com/v2/bookings/${booking.id}`,
      { title: newTitle },
      {
        headers: {
          'Authorization': `Bearer ${CAL_COM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Failed to update booking title:', error);
  }
}
```

### Option 2: Cal.com Title Template (If Available)

Some Cal.com versions support title templates. Check if your Cal.com account supports dynamic title templates in:
- Settings → Event Types → [Your Event] → Advanced → Title Template

If available, you could use a template like:
```
{{eventType.title}} - {{attendee.name}} - {{metadata.paymentType}}
```

**Note:** This may not be available in all Cal.com plans or versions.

### Option 3: Custom Questions (Workaround)

Add a custom question to capture payment type, then use it in the title:
1. Settings → Event Types → [Your Event] → Questions
2. Add question: "Payment Type" (Hidden field, pre-filled from URL params)
3. Use the question response in title template if supported

## Current Implementation Status

The webhook handler (`app/api/webhooks/cal-com/route.ts`) currently:
- ✅ Verifies payment and booking token
- ✅ Stores payment type in database
- ✅ Links Cal.com booking to payment

**Next Step:** Add booking title update logic to the webhook handler (Option 1 above).

## Testing

1. Complete a payment flow with test cards
2. Book an appointment on Cal.com
3. Check the calendar event title in Cal.com dashboard
4. Verify it follows the format: `[Event Type] - [Client Name] - [Payment Type]`

## Notes

- Client name comes from the Cal.com booking attendee information
- Payment type is passed via URL parameters and stored in booking metadata
- Title updates may take a few seconds to reflect in Cal.com
- If the webhook fails, the booking will still be created but with default title

