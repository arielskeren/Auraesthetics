# Payment System Integration - Phase 1: Flow B (Custom Payment Popup)

## Overview
Implement custom payment popup flow that allows clients to customize payment options before booking via Cal.com, with discount codes, payment authorization, and automated welcome emails.

## Requirements Summary
- ✅ Flow B: Custom payment popup (not Cal.com native)
- ✅ Discount codes via Stripe Coupons (Strategy 2, Option B)
- ✅ 50% deposit option alongside full payment
- ✅ Brevo welcome email with discount code
- ✅ Neon PostgreSQL database for bookings
- ⏸️ Payment plans: Deferred to later phase

---

## Phase 1: Database Setup & Schema

### Neon Database Setup
1. Create Neon account (free tier: 0.5GB storage, generous compute)
2. Create new database project
3. Get connection string
4. Add to `.env.local` and Vercel environment variables

### Database Schema

**Bookings Table:**
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cal_booking_id VARCHAR(255) UNIQUE,
  service_id VARCHAR(100),
  service_name VARCHAR(255),
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  booking_date TIMESTAMP,
  amount DECIMAL(10, 2),
  deposit_amount DECIMAL(10, 2),
  final_amount DECIMAL(10, 2),
  discount_code VARCHAR(50),
  discount_amount DECIMAL(10, 2),
  payment_status VARCHAR(50), -- 'paid', 'deposit', 'pending', 'authorized', 'cancelled'
  payment_intent_id VARCHAR(255),
  payment_method_id VARCHAR(255), -- For Stripe payment method
  plaid_authorization_id VARCHAR(255), -- For pay-later holds
  plaid_authorization_amount DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB -- Store additional Cal.com data
);
```

**Discount Codes Table:**
```sql
CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  stripe_coupon_id VARCHAR(255), -- Link to Stripe coupon
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_bookings_cal_id ON bookings(cal_booking_id);
CREATE INDEX idx_bookings_email ON bookings(client_email);
CREATE INDEX idx_bookings_status ON bookings(payment_status);
CREATE INDEX idx_discount_codes_code ON discount_codes(code);
```

---

## Phase 2: Custom Payment Modal Component

### File: `app/_components/CustomPaymentModal.tsx`

**Features:**
- Service details display
- Discount code input field
- Payment method selector:
  - Pay Full Amount
  - Pay Deposit (50% default, customizable)
  - Live availability preview (7-day window with week navigation)
  - Pay Full Amount
  - Pay 50% Deposit
- Stripe Elements integration
- Plaid Link integration (for pay-later)
- Loading states and error handling

**Flow:**
1. User selects service → Modal opens
2. User enters discount code (optional) → Validate via API
3. User selects payment method
4. Process payment (full or 50% deposit)
5. Store payment intent details
6. Open Cal.com with metadata after verification

---

## Phase 3: API Routes

### 3.1 Discount Code Validation
**File**: `app/api/payments/validate-discount/route.ts`

**Flow:**
1. Receive discount code and amount
2. Check Stripe for coupon existence
3. Validate coupon (active, not expired, usage limits)
4. Calculate discount amount
5. Return final amount and discount details

**Stripe Coupon Validation:**
```typescript
const coupon = await stripe.coupons.retrieve(code);
// Check: active, valid, redeemable
```

### 3.2 Create Payment Intent
**File**: `app/api/payments/create-intent/route.ts`

**Flow:**
1. Receive: serviceId, amount, discountCode, paymentType
2. Validate discount code (if provided)
3. Calculate final amount
4. Create Stripe Payment Intent:
   - For "Pay Full": Capture immediately
   - For "Deposit": Capture deposit amount
   - For "Deposit": Charge 50% of final amount, store balance due metadata
5. Return client_secret

### 3.3 Cal.com Availability Proxy *(New)*
**File**: `app/api/cal/availability/route.ts`

**Flow:**
1. Receive `slug`, optional `start`, `days`, `timezone`
2. Load `docs/cal-event-types.json` to map slug → event type ID
3. Call Cal.com availability endpoint with 7-day window
4. Return grouped availability + metadata for frontend display

**Notes:**
- Used by `CustomPaymentModal` to show live slots before payment
- Supports week navigation (increments of 7 days)

### 3.4 Create Booking Record
**File**: `app/api/bookings/create/route.ts`

**Flow:**
1. Receive booking data from Cal.com webhook or custom flow
2. Extract payment details (intent ID, authorization ID, etc.)
3. Insert into Neon database
4. Link to Cal.com booking ID
5. Return booking confirmation

### 3.5 Cal.com Webhook Handler
**File**: `app/api/webhooks/cal-com/route.ts`

**Flow:**
1. Verify webhook signature (if Cal.com provides)
2. On `BOOKING_CREATED` event:
   - Extract booking data
   - Extract custom metadata (paymentIntentId, discountCode, etc.)
   - Create/update booking record in Neon
   - Send confirmation email via Brevo
3. On `BOOKING_CANCELLED`:
   - Update booking status
   - Process refund/authorization release if needed

---

## Phase 4: Brevo Welcome Email Integration

### 4.1 Email Template Setup
**File**: `app/api/emails/send-welcome/route.ts`

**Flow:**
1. Receive: email, name, discountCode
2. Create personalized email with discount code
3. Send via Brevo API
4. Track email delivery

**Brevo Template:**
- Welcome message
- Discount code prominently displayed
- Terms and conditions
- Booking instructions

### 4.2 Integrate with Email Capture Flow
**File**: `app/api/subscribe/route.ts` (modify existing)

**Add:**
- After successful subscription
- Call `send-welcome` API
- Include discount code from existing logic

---

## Phase 5: Stripe Setup

### 5.1 Stripe Coupons Creation
**Manual Setup in Stripe Dashboard:**
1. Create coupons for existing discount codes:
   - WELCOME15 (15% off, max $30)
   - FIRST50 ($50 off)
   - Others as needed
2. Store coupon IDs in database (discount_codes table)

### 5.2 Stripe Payment Methods
- Install `@stripe/stripe-js`
- Install `@stripe/react-stripe-js`
- Configure Stripe Elements
- Configure Plaid Link (via Stripe)

---

## Phase 6: BookingModal Integration

### Modify: `app/_components/BookingModal.tsx`

**Changes:**
1. Remove direct Cal.com embed button
2. Add "Book Now" button → Opens CustomPaymentModal
3. After payment/authorization → Open Cal.com with metadata
4. Pass payment details to Cal.com via custom questions/metadata

**Cal.com Metadata Passing:**
```typescript
// Pass via URL params or custom questions
const calUrl = `${calLink}?metadata=${encodeURIComponent(JSON.stringify({
  paymentIntentId,
  discountCode,
  paymentType,
  authorizationId
}))}`;
```

---

## Phase 7: Admin Dashboard (Simplified)

### File: `app/admin/bookings/page.tsx`

**Features:**
- List all bookings
- Filter by payment status
- View payment details
- Manual payment status updates
- View authorizations (for pay-later bookings)

---

## Implementation Checklist

### Database Setup
- [ ] Create Neon account
- [ ] Create database and tables
- [ ] Set up connection string
- [ ] Add to environment variables
- [ ] Test connection

### Stripe Setup
- [ ] Install Stripe packages
- [ ] Create Stripe coupons in dashboard
- [ ] Set up webhook endpoint
- [ ] Configure Plaid integration (if needed)
- [ ] Test payment intents

### API Routes
- [ ] Create discount validation endpoint
- [ ] Create payment intent endpoint
- [ ] Create Plaid authorization endpoint
- [ ] Create booking record endpoint
- [ ] Create Cal.com webhook handler
- [ ] Create Brevo welcome email endpoint

### Components
- [ ] Create CustomPaymentModal component
- [ ] Integrate Stripe Elements
- [ ] Integrate Plaid Link (for pay-later)
- [ ] Modify BookingModal
- [ ] Update BookClient page

### Email Integration
- [ ] Create welcome email template
- [ ] Integrate with Brevo
- [ ] Test email delivery
- [ ] Link to existing email capture flow

### Testing
- [ ] Test discount code validation
- [ ] Test payment intents (full, deposit)
- [ ] Test Plaid authorization flow
- [ ] Test Cal.com booking with metadata
- [ ] Test webhook handling
- [ ] Test email delivery

---

## Dependencies to Install

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js stripe
npm install @neondatabase/serverless # or @neon/serverless
npm install plaid # if using Plaid directly
```

---

## Environment Variables

```env
# Existing
BREVO_API_KEY=...
CAL_COM_API_KEY=...

# New
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEON_DATABASE_URL=postgresql://...
PLAID_CLIENT_ID=... # if using Plaid
PLAID_SECRET=... # if using Plaid
```

---

## Estimated Timeline

- **Phase 1 (Database)**: 1-2 hours
- **Phase 2 (Custom Modal)**: 4-6 hours
- **Phase 3 (API Routes)**: 4-5 hours
- **Phase 4 (Email)**: 2-3 hours
- **Phase 5 (Stripe Setup)**: 1-2 hours
- **Phase 6 (Integration)**: 2-3 hours
- **Phase 7 (Admin Dashboard)**: 2-3 hours
- **Testing & Polish**: 3-4 hours

**Total**: 19-28 hours

---

## Notes

- Plaid integration: Consider using Stripe's built-in Plaid support or direct Plaid Link
- Cal.com metadata: May need to use custom questions or webhook data
- Authorization holds: Stripe Payment Intents can create authorizations without capturing
- Webhook security: Implement signature verification for Cal.com webhooks

