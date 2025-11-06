# Cal.com Integration Guide

## Overview
Cal.com integration for booking system with Outlook calendar sync and Stripe payments.

## Setup

### 1. Account Setup
- Sign up at https://cal.com (Free plan)
- Connect Microsoft 365 / Outlook calendar
- Enable "Block out times" option

### 2. Stripe Connection
- Settings → Apps → Stripe → Install
- Connect Stripe account
- Verify connection status

### 3. Event Types
**Per-Service Events** (recommended):
- Individual events for each service
- Automated via API scripts: `npm run create-cal-events-safe`
- See `docs/guides/cal-com-rate-limits.md` for API best practices

## API Scripts

```bash
npm run create-cal-events-safe     # Create events (safe mode)
npm run update-cal-events          # Update pricing/duration
npm run verify-cal-events          # Verify all events exist
npm run update-cal-buffer          # Update buffer times
npm run update-cal-locations       # Update locations
```

## Integration

### Embed Script
`app/_hooks/useCalEmbed.ts` loads Cal.com embed globally.

### Booking Modal
`app/_components/BookingModal.tsx` displays Cal.com booking widget.

### Custom Payment Flow
See `docs/payment-integration/phase-1-flow-b.md` for custom payment popup integration.

## Rate Limits

⚠️ **Important**: Cal.com has strict rate limits. See `docs/guides/cal-com-rate-limits.md` for safe API usage.

## Current Status

- ✅ Events created for all services
- ✅ Calendar sync configured
- ✅ Stripe connected
- ⏳ Custom payment flow in progress (Phase 1)

