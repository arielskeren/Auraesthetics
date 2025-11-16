<!-- Archived 2025-11-16: Legacy Cal.com note; retained for historical reference -->

# Cal.com Workflows Setup Guide

## Overview
Cal.com workflows allow you to automate email and SMS reminders for bookings. This guide explains how to set them up in your Cal.com dashboard.

## What Are Workflows?

Workflows are automated actions that trigger based on booking events:
- **Email Reminders**: Send automated emails before appointments
- **SMS Reminders**: Send text messages before appointments
- **Custom Actions**: Trigger other integrations

## Setting Up Workflows

### Step 1: Access Workflows

1. Log in to your Cal.com account
2. Navigate to **Settings** → **Workflows** (or **Automations**)
3. Click **+ New Workflow**

### Step 2: Create Email Reminder Workflow

1. **Trigger**: Select "Before an event"
   - Set time: 24 hours before (or your preferred reminder time)
   - You can add multiple reminders (e.g., 48 hours, 24 hours, 2 hours)

2. **Action**: Select "Send email"
   - Choose or create an email template
   - Include booking details:
     - Event name
     - Date and time
     - Location/instructions
     - Payment information (if needed)

3. **Conditions** (Optional):
   - Only send for confirmed bookings
   - Exclude certain event types if needed

4. **Save** the workflow

### Step 3: Create SMS Reminder Workflow

1. **Trigger**: Select "Before an event"
   - Set time: 2 hours before (or your preferred reminder time)

2. **Action**: Select "Send SMS"
   - Note: SMS requires a paid Cal.com plan or SMS integration (Twilio, etc.)
   - Configure your SMS provider if needed

3. **Save** the workflow

### Step 4: Enable Workflows for Event Types

1. Go to **Settings** → **Event Types**
2. Select an event type
3. Scroll to **Workflows** section
4. Enable the workflows you created
5. Repeat for all event types

## Recommended Workflow Templates

### Email Reminder (24 Hours Before)
```
Subject: Reminder: Your Appointment Tomorrow

Hi {{attendee.name}},

This is a friendly reminder about your upcoming appointment:

Event: {{eventType.title}}
Date: {{date}}
Time: {{time}}
Duration: {{duration}} minutes

{{#if location}}
Location: {{location}}
{{/if}}

Please arrive 10 minutes early.

If you need to reschedule or cancel, please let us know at least 24 hours in advance.

Best regards,
Aura Wellness Aesthetics
```

### SMS Reminder (2 Hours Before)
```
Hi {{attendee.name}}, reminder: {{eventType.title}} today at {{time}}. See you soon! - Aura Wellness Aesthetics
```

## Workflow Events Available

- `BOOKING_CREATED`: When a booking is made
- `BOOKING_CONFIRMED`: When a booking is confirmed
- `BOOKING_CANCELLED`: When a booking is cancelled
- `BOOKING_RESCHEDULED`: When a booking is rescheduled
- `BEFORE_EVENT`: X hours/days before the event (for reminders)

## API-Based Workflow Setup (Advanced)

While Cal.com workflows are typically configured via the dashboard, you can also use the Cal.com API to create workflows programmatically if your plan supports it.

**Note:** The Cal.com API for workflows may not be available in all plans. Check the Cal.com API documentation for your plan's capabilities.

## Integration with Your System

Your current setup:
- ✅ Payment processing via Stripe
- ✅ Booking verification via tokens
- ✅ Cal.com webhook integration

Workflows complement this by:
- Sending reminders automatically
- Reducing no-shows
- Improving customer experience

## Testing Workflows

1. Create a test booking
2. Wait for the workflow trigger time (or adjust trigger to "immediately" for testing)
3. Verify email/SMS is received
4. Check that all variables are replaced correctly ({{attendee.name}}, etc.)

## Troubleshooting

**Workflows not triggering:**
- Check that workflows are enabled for the event type
- Verify trigger conditions are met
- Check Cal.com logs/dashboard for errors

**SMS not working:**
- Verify SMS provider is configured
- Check if SMS is available in your plan
- Ensure phone numbers are in correct format

**Email not sending:**
- Check spam folder
- Verify email templates are valid
- Check Cal.com email delivery logs

## Cost Considerations

- **Email Reminders**: Usually included in all Cal.com plans
- **SMS Reminders**: May require paid plan or separate SMS provider subscription
- **Workflow Limits**: Check your plan's workflow limits

## Next Steps

1. Set up email reminder workflows (24 hours, 2 hours before)
2. Configure SMS reminders if available in your plan
3. Test workflows with a few test bookings
4. Monitor and adjust reminder times based on client feedback

## Resources

- [Cal.com Workflows Documentation](https://cal.com/docs/enterprise-features/workflows)
- [Cal.com API Documentation](https://developer.cal.com/api)
- Your Cal.com dashboard: Settings → Workflows

