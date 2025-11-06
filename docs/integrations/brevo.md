# Brevo Email Integration

## Overview
Email capture and tracking system using Brevo for contact management and welcome emails.

## Setup

### Custom Attribute: SIGNUP_SOURCE
Track where users signed up:
1. Brevo Dashboard → Contacts → Settings → Contact Attributes
2. Add attribute: `SIGNUP_SOURCE` (Text type)
3. Values: `welcome-offer`, `footer`, `floating-bubble`, `book-page`

## Implementation

### API Route
`app/api/subscribe/route.ts` sends signup source to Brevo:

```typescript
attributes.SIGNUP_SOURCE = signupSource || 'footer';
```

### Components
- `EmailCapture.tsx` - Main email capture form
- `EmailCaptureModal.tsx` - Modal version
- `FloatingWelcomeOffer.tsx` - Floating bubble
- All pass `signupSource` prop

## Welcome Email Integration

See `docs/payment-integration/phase-1-flow-b.md` for Brevo welcome email with discount codes.

## Segmentation

Create segments in Brevo:
- Filter by `SIGNUP_SOURCE = "welcome-offer"`
- Send targeted emails to specific signup sources

