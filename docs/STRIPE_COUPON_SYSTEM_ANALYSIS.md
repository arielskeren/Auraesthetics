# Stripe + Neon Coupon System - Complete Analysis

This document provides a comprehensive analysis of the current Stripe PaymentIntent + Neon coupon system implementation, answering all design questions to help build a system that fits exactly into the existing flow.

---

## Table of Contents

1. [Tech Stack + Where Stripe is Called](#1-tech-stack--where-stripe-is-called)
2. [Current PaymentIntent Flow (Step-by-Step)](#2-current-paymentintent-flow-step-by-step)
3. [How Coupons Are Supposed to Work](#3-how-coupons-are-supposed-to-work)
4. [How You Are Currently Modeling Coupons in Stripe](#4-how-you-are-currently-modeling-coupons-in-stripe)
5. [Neon Schema and Sync Logic](#5-neon-schema-and-sync-logic)
6. [Error Details When Creating Coupon Codes](#6-error-details-when-creating-coupon-codes)
7. [What You Ultimately Want (Given PaymentIntent)](#7-what-you-ultimately-want-given-paymentintent)
8. [Operational / Admin Requirements](#8-operational--admin-requirements)

---

## 1. Tech Stack + Where Stripe is Called

### 1.1. What is your backend stack and Stripe library usage?

**Answer:**

- **Language / Framework**: Next.js 14.2.0 with TypeScript, using Next.js API routes
- **Stripe Library**: Official Stripe Node.js SDK (`stripe` package v19.3.0)
- **Initialization**: Centralized in `lib/stripeClient.ts`

**Code Reference:**

```8:10:lib/stripeClient.ts
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
});
```

**Package.json Reference:**

```29:29:package.json
    "stripe": "^19.3.0"
```

### 1.2. Where do you currently create the PaymentIntent?

**Answer:**

PaymentIntent is created on the server in a Next.js API route, after a frontend request.

**Endpoint**: `POST /api/payments/create-intent`

**Code Reference:**

```62:72:lib/stripeClient.ts
export async function createPaymentIntent(input: CreatePaymentIntentInput) {
  return stripe.paymentIntents.create({
    amount: input.amount,
    currency: input.currency,
    receipt_email: input.customerEmail ?? undefined,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: input.metadata,
  });
}
```

**API Route Handler:**

```135:149:app/api/payments/create-intent/route.ts
    const pi = await createPaymentIntent({
      amount: unitAmount,
      currency: 'usd',
      customerEmail: email ?? null,
      metadata: {
        service_id: svc.id,
        service_slug: svc.slug,
        hapio_service_id: hapioServiceId ?? '',
        slot_start: slotStart,
        slot_end: slotEnd,
        timezone: timezone ?? '',
        hapio_booking_id: bookingId ?? '',
        discountCode: discountCode ? discountCode.toUpperCase() : '',
      },
    });
```

### 1.3. Do you ever use Checkout Sessions or Invoices?

**Answer:**

No. The system uses **strictly PaymentIntent → Confirm → Done** flow.

- ❌ No Checkout Sessions
- ❌ No Invoices
- ❌ No subscription objects
- ✅ PaymentIntent with `automatic_payment_methods.enabled: true`
- ✅ Frontend confirmation using `stripe.confirmCardPayment()`

**Code Reference:**

```67:69:lib/stripeClient.ts
    automatic_payment_methods: {
      enabled: true,
    },
```

---

## 2. Current PaymentIntent Flow (Step-by-Step)

### 2.1. Walk through the flow for a single purchase

**Step 1: Frontend screens the user sees**

1. User selects service and time slot in `BookingModal`
2. `CustomPaymentModal` opens with payment form
3. User enters:
   - Contact information (first name, last name, email, phone)
   - Optional discount code
   - Payment type (full or 50% deposit)
   - Card details

**Code Reference - Discount Code Input:**

```479:537:app/_components/CustomPaymentModal.tsx
      <div className="border border-sand rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-charcoal mb-2">
            Discount Code (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={discountCode}
              onChange={(event) => {
                setDiscountCode(event.target.value.toUpperCase());
                setDiscountValidation(null);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (discountCode.trim() && !processing && !validatingDiscount) {
                    void validateDiscount();
                  }
                }
              }}
              placeholder="Enter code"
              className="flex-1 px-3 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
              disabled={processing || validatingDiscount || success}
            />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void validateDiscount();
              }}
              disabled={processing || validatingDiscount || !discountCode.trim() || success}
              className="px-4 py-2 bg-dark-sage text-charcoal rounded-lg font-medium text-sm hover:bg-sage-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {validatingDiscount ? '...' : 'Apply'}
            </button>
          </div>
```

**Step 2: Backend call to create PaymentIntent**

**Endpoint**: `POST /api/payments/create-intent`

**Parameters passed:**

```8:19:app/api/payments/create-intent/route.ts
    const { serviceId, serviceSlug, slotStart, slotEnd, timezone, email, bookingId, amountCents, discountCode } =
      (await request.json()) as {
        serviceId?: string;
        serviceSlug?: string;
        slotStart: string;
        slotEnd: string;
        timezone?: string | null;
        email?: string | null;
        bookingId?: string | null;
        amountCents?: number | null;
        discountCode?: string | null;
      };
```

**Key Parameters:**
- `amount`: Calculated in cents (already discounted if code applied)
- `currency`: `'usd'` (hardcoded)
- `customerEmail`: From contact form
- `metadata`: Comprehensive metadata including:
  - `service_id`, `service_slug`, `hapio_service_id`
  - `slot_start`, `slot_end`, `timezone`
  - `hapio_booking_id`
  - `discountCode`: Uppercase code string (if applied)

**Note**: No `customer` ID is passed - no Stripe Customer object is created.

**Step 3: How is the PaymentIntent confirmed?**

**Frontend confirmation** using Stripe.js `stripe.confirmCardPayment()`:

```307:316:app/_components/CustomPaymentModal.tsx
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: `${trimmedContact.firstName} ${trimmedContact.lastName}`.trim(),
              email: trimmedContact.email,
              phone: trimmedContact.phone || undefined,
            },
          },
        });
```

**Server does NOT use `confirm: true`** - confirmation happens entirely client-side.

### 2.2. Do you ever update the PaymentIntent amount after creation?

**Answer:**

No. The PaymentIntent amount is **never updated** after creation.

- Amount is calculated **before** PaymentIntent creation
- Discount is applied client-side, then sent as `amountCents` parameter
- PaymentIntent is created with the final discounted amount already set

**Code Reference - Amount Calculation:**

```97:126:app/api/payments/create-intent/route.ts
    // Determine amount in cents:
    // 1) Use explicit amountCents from client (e.g., deposit or discounted amount) if >= Stripe min.
    // 2) Else fall back to DB price * 100.
    let unitAmount = 0;
    if (typeof amountCents === 'number' && Number.isFinite(amountCents)) {
      unitAmount = Math.round(Math.max(0, amountCents));
    }
    if (unitAmount <= 0) {
      const fromDb =
        typeof svc.price === 'number' && Number.isFinite(svc.price)
          ? Math.round(svc.price * 100)
          : 0;
      unitAmount = fromDb;
    }

    // Enforce Stripe minimum (USD = 50 cents). If below, return helpful error.
    const MIN_USD_CENTS = 50;
    if (unitAmount < MIN_USD_CENTS) {
      return NextResponse.json(
        {
          error:
            'Calculated amount is below the minimum chargeable amount. Please ensure the service has a price or provide a valid amount.',
          details: {
            providedAmountCents: amountCents ?? null,
            dbPriceCents: typeof svc.price === 'number' ? Math.round(svc.price * 100) : null,
          },
        },
        { status: 400 }
      );
    }
```

### 2.3. Do you have any other discount or price logic?

**Answer:**

Yes, additional pricing logic exists:

1. **Deposit Option**: 50% deposit, balance due later
   - See: ```144:145:app/_components/CustomPaymentModal.tsx```
   - `amountDueToday = paymentType === 'deposit' ? finalAmount * 0.5 : finalAmount`

2. **Discount Codes**: Percent-off or fixed-amount discounts
   - Percent discounts can have optional `discount_cap` (e.g., 15% off, max $30)
   - See discount validation: ```315:349:app/api/payments/validate-discount/route.ts```

3. **No line item discounts** or special customer pricing beyond coupon codes

---

## 3. How Coupons Are Supposed to Work (Intended UX / Business Rules)

### 3.1. Where does the user enter a coupon code in the UI?

**Answer:**

- **Location**: Same screen as card details (in `CustomPaymentModal`)
- **Timing**: **Before** PaymentIntent is created
- **Flow**: 
  1. User enters code → validates via `/api/payments/validate-discount`
  2. If valid, creates PaymentIntent with discounted amount
  3. If invalid, shows error and user can retry

**Code Reference - Validation Flow:**

```180:242:app/_components/CustomPaymentModal.tsx
  const validateDiscount = useCallback(async () => {
    if (!discountCode.trim()) {
      setDiscountValidation(null);
      return;
    }

    // For customer-specific codes, require email before validation
    // We'll check this on the server, but also validate here for better UX
    if (!contactDetails.email?.trim() || !isValidEmail(contactDetails.email)) {
        setDiscountValidation({
          valid: false,
          discountAmount: 0,
          finalAmount: baseAmount,
          originalAmount: baseAmount,
          isOneTime: false,
          requiresEmail: true,
        });
        setError('Please enter your email address to verify your eligibility for discount codes');
        return;
    }

    setValidatingDiscount(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/validate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: discountCode.trim().toUpperCase(),
          amount: baseAmount,
          customerEmail: contactDetails.email?.trim() || null,
          customerName: contactDetails.firstName && contactDetails.lastName 
            ? `${contactDetails.firstName.trim()} ${contactDetails.lastName.trim()}`.trim()
            : null,
        }),
      });

      const data = await response.json();
      if (data.valid) {
        setDiscountValidation(data);
        // If it's a one-time code, show message about email verification
        if (data.isOneTime && data.requiresEmail === false) {
          // Email was verified - no additional message needed
        }
      } else {
        setDiscountValidation({
          valid: false,
          discountAmount: 0,
          finalAmount: baseAmount,
          originalAmount: baseAmount,
          isOneTime: false,
          requiresEmail: data.requiresEmail || false,
        });
        setError(data.error || 'Invalid discount code');
      }
    } catch {
      setError('Failed to validate discount code');
      setDiscountValidation(null);
    } finally {
      setValidatingDiscount(false);
    }
  }, [discountCode, baseAmount, contactDetails.email, contactDetails.firstName, contactDetails.lastName]);
```

### 3.2. What is your intended behavior for codes?

**Answer:**

**One-time codes:**
- Used exactly **once ever** by anyone (or once per customer if customer-specific)
- Stored in `one_time_discount_codes` table with `used` boolean flag
- Can be customer-specific via `customer_id` foreign key

**Code Reference - One-time Code Schema:**

```2:17:scripts/migrations/006_create_one_time_discount_codes.sql
CREATE TABLE IF NOT EXISTS one_time_discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'dollar')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  stripe_coupon_id VARCHAR(255),
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(100) -- Track who created it (e.g., 'admin', 'system')
);
```

**Global codes:**
- Reusable by anyone until `max_uses` limit or expiration
- Stored in `discount_codes` table
- Can have `max_uses` (null = unlimited) and `expires_at`

**Code Reference - Global Code Usage Check:**

```62:103:app/api/admin/global-discount-codes/route.ts
    // For each code, get usage count from Stripe
    const codesWithUsage = await Promise.all(
      codes.map(async (code) => {
        let usageCount = 0;
        let timesRedeemed = 0;

        if (code.stripe_coupon_id) {
          try {
            const coupon = await stripe.coupons.retrieve(code.stripe_coupon_id);
            timesRedeemed = coupon.times_redeemed || 0;
            
            // Also check promotion codes if they exist
            if (coupon.id) {
              const promotionCodes = await stripe.promotionCodes.list({
                coupon: coupon.id,
                limit: 100,
              });
              
              // Sum up times_redeemed from all promotion codes
              usageCount = promotionCodes.data.reduce((sum, pc) => {
                return sum + (pc.times_redeemed || 0);
              }, 0);
              
              // If no promotion codes, use coupon times_redeemed
              if (usageCount === 0) {
                usageCount = timesRedeemed;
              }
            } else {
              usageCount = timesRedeemed;
            }
          } catch (e) {
            console.error(`[Global Discount Codes] Error fetching Stripe usage for ${code.code}:`, e);
          }
        }

        return {
          ...code,
          usage_count: usageCount,
          times_redeemed: timesRedeemed,
        };
      })
    );
```

### 3.3. Do coupons change only the final amount or also metadata?

**Answer:**

Coupons change:
- ✅ **Only the final amount charged** (PaymentIntent.amount is pre-calculated with discount)
- ✅ **Metadata includes `discountCode: "WELCOME10"`** in PaymentIntent metadata

**Code Reference - Metadata Inclusion:**

```139:149:app/api/payments/create-intent/route.ts
      metadata: {
        service_id: svc.id,
        service_slug: svc.slug,
        hapio_service_id: hapioServiceId ?? '',
        slot_start: slotStart,
        slot_end: slotEnd,
        timezone: timezone ?? '',
        hapio_booking_id: bookingId ?? '',
        discountCode: discountCode ? discountCode.toUpperCase() : '',
      },
```

### 3.4. Do you need to support percent-off, fixed amount, or both?

**Answer:**

**Both are supported:**

1. **Percent-off discounts**: e.g., 15% off (with optional `discount_cap` like $30 max)
2. **Fixed amount discounts**: e.g., $10 off

**Code Reference - Discount Calculation:**

```315:349:app/api/payments/validate-discount/route.ts
      // Calculate discount amount
      let discountAmount = 0;
      let finalAmount = amount;

      if (coupon.percent_off) {
        // Percentage discount
        const discount = (amount * coupon.percent_off) / 100;
        discountAmount = discount;
        
        // Apply max discount if specified
        // Check discount_cap from database (for one-time codes) or coupon metadata
        let maxDiscount = 0;
        if (isOneTime && discountCode?.discount_cap) {
          // Use discount_cap from database for one-time codes
          maxDiscount = Number(discountCode.discount_cap);
        } else if (coupon.metadata?.discount_cap) {
          // Check coupon metadata for discount_cap
          maxDiscount = parseFloat(coupon.metadata.discount_cap);
        } else if (coupon.metadata?.max_discount) {
          // Fallback to max_discount in metadata
          maxDiscount = parseFloat(coupon.metadata.max_discount);
        } else if (coupon.id === 'L0DshEg5' || code.toUpperCase() === 'WELCOME15') {
          // WELCOME15 has a $30 cap (hardcoded for legacy support)
          maxDiscount = 30;
        }
        
        if (maxDiscount > 0 && discountAmount > maxDiscount) {
          discountAmount = maxDiscount;
        }
        finalAmount = amount - discountAmount;
      } else if (coupon.amount_off) {
        // Fixed amount discount
        discountAmount = coupon.amount_off / 100; // Stripe stores in cents
        finalAmount = Math.max(0, amount - discountAmount);
      }
```

---

## 4. How You Are Currently Modeling Coupons in Stripe

### 4.1. Right now, are you actually creating Stripe coupons / promotion codes?

**Answer:**

**Yes, you create both Stripe coupons AND promotion codes**, but you also keep your own coupon logic in Neon and adjust PaymentIntent.amount manually. It's a **hybrid approach**.

**Code Reference - Stripe Coupon Creation:**

```181:212:app/api/admin/global-discount-codes/route.ts
    // Create Stripe coupon
    // Note: For one-time payments (not subscriptions), duration must be 'once'
    // The max_redemptions limit is set on the promotion code, not the coupon
    const couponName = `Global: ${codeUpper}`;
    let coupon;
    if (discountType === 'percent') {
      const couponParams: any = {
        name: couponName,
        duration: 'once', // Required for one-time payments (not subscriptions)
        percent_off: Math.round(discountValue),
        metadata: {
          global_code: codeUpper,
          discount_type: discountType,
        },
      };
      if (discountCap) {
        couponParams.metadata.discount_cap = String(discountCap);
      }
      // Note: max_redemptions is set on the promotion code, not the coupon
      coupon = await stripe.coupons.create(couponParams);
    } else {
      coupon = await stripe.coupons.create({
        name: couponName,
        duration: 'once', // Required for one-time payments (not subscriptions)
        amount_off: Math.round(discountValue * 100),
        currency: 'usd',
        metadata: {
          global_code: codeUpper,
          discount_type: discountType,
        },
      });
    }
```

**Code Reference - Promotion Code Creation:**

```214:252:app/api/admin/global-discount-codes/route.ts
    // Create promotion code for the coupon
    // Set max_redemptions on the promotion code to limit total uses across all customers
    // CRITICAL: Ensure coupon.id is a string and properly formatted
    const couponId = String(coupon.id).trim();
    if (!couponId || couponId.length === 0) {
      // Clean up coupon if ID is invalid
      try {
        await stripe.coupons.del(coupon.id);
      } catch (delError) {
        console.error('[Create Global Discount Code] Failed to clean up coupon with invalid ID:', delError);
      }
      return NextResponse.json(
        { error: 'Invalid coupon ID from Stripe' },
        { status: 500 }
      );
    }

    // Build promotion code parameters explicitly
    // Note: Stripe API accepts 'coupon' parameter but TypeScript types expect 'promotion'
    // Using 'any' to bypass type checking since we know the API accepts this structure
    const promotionCodeParams: any = {
      coupon: couponId, // Explicitly use string
      code: codeUpper,
      active: isActive,
    };
    if (maxUses && maxUses > 0) {
      promotionCodeParams.max_redemptions = maxUses;
    }
    
    let promotionCode: Stripe.PromotionCode;
    try {
      console.log('[Create Global Discount Code] Creating promotion code with params:', {
        coupon: couponId,
        code: codeUpper,
        active: isActive,
        max_redemptions: maxUses || undefined,
      });
      promotionCode = await stripe.promotionCodes.create(promotionCodeParams);
      console.log('[Create Global Discount Code] Promotion code created successfully:', promotionCode.id);
    } catch (promoError: any) {
```

### 4.2. Which endpoints are you calling and which parameters?

**Answer:**

**Endpoints:**
- `/v1/coupons` - `stripe.coupons.create()` and `stripe.coupons.retrieve()`
- `/v1/promotion_codes` - `stripe.promotionCodes.create()`

**Key Parameters:**

1. **Coupon Creation:**
   - `duration: 'once'` (REQUIRED for one-time payments, not subscriptions)
   - `percent_off` OR `amount_off` (cents)
   - `currency: 'usd'` (for amount_off)
   - `metadata`: `{ global_code: "CODE", discount_type: "percent" }`
   - `metadata.discount_cap`: String value for max discount cap

2. **Promotion Code Creation:**
   - `coupon`: Coupon ID (string)
   - `code`: Human-readable code (e.g., "WELCOME15")
   - `active`: Boolean
   - `max_redemptions`: Integer (set on promotion code, NOT coupon)

**Code Reference - One-time Code Coupon Creation:**

```108:138:app/api/admin/discount-codes/[id]/route.ts
        // Create new coupon FIRST (before deleting old one to avoid orphaned state)
        const couponName = `One-time: ${existingCode.code}`;
        let coupon: Stripe.Coupon;
        if (discountType === 'percent') {
          const couponParams: Stripe.CouponCreateParams = {
            name: couponName,
            duration: 'once',
            percent_off: Math.round(discountValue),
            metadata: {
              one_time_code: existingCode.code,
              discount_type: discountType,
            },
          };
          if (discountCap) {
            couponParams.metadata = {
              ...couponParams.metadata,
              discount_cap: String(discountCap),
            };
          }
          coupon = await stripe.coupons.create(couponParams);
        } else {
          coupon = await stripe.coupons.create({
            name: couponName,
            duration: 'once',
            amount_off: Math.round(discountValue * 100),
            currency: 'usd',
            metadata: {
              one_time_code: existingCode.code,
              discount_type: discountType,
            },
          });
        }
```

### 4.3. How do those coupons/promotion codes tie into the PaymentIntent?

**Answer:**

**They DON'T tie into PaymentIntent directly.** Here's the current flow:

1. **Stripe coupons/promotion codes are used as lookup/validation:**
   - Retrieve coupon from Stripe
   - Calculate discount manually
   - Create PaymentIntent with manually adjusted amount

2. **PaymentIntent metadata includes `discountCode` string**, but no `coupon` or `promotion_code` parameter

3. **Why?** PaymentIntent doesn't support direct coupon application (only Checkout Sessions and Invoices do)

**Code Reference - Validation Flow (No Direct Application):**

```297:370:app/api/payments/validate-discount/route.ts
    // Validate coupon with Stripe
    try {
      if (!stripeCouponId) {
        return NextResponse.json(
          { error: 'Invalid discount code - no Stripe coupon ID', valid: false },
          { status: 400 }
        );
      }
      const coupon = await stripe.coupons.retrieve(stripeCouponId);

      // Check if coupon is valid
      if (!coupon.valid) {
        return NextResponse.json(
          { error: 'Discount code is no longer valid', valid: false },
          { status: 400 }
        );
      }

      // Calculate discount amount
      let discountAmount = 0;
      let finalAmount = amount;

      if (coupon.percent_off) {
        // Percentage discount
        const discount = (amount * coupon.percent_off) / 100;
        discountAmount = discount;
        
        // Apply max discount if specified
        // Check discount_cap from database (for one-time codes) or coupon metadata
        let maxDiscount = 0;
        if (isOneTime && discountCode?.discount_cap) {
          // Use discount_cap from database for one-time codes
          maxDiscount = Number(discountCode.discount_cap);
        } else if (coupon.metadata?.discount_cap) {
          // Check coupon metadata for discount_cap
          maxDiscount = parseFloat(coupon.metadata.discount_cap);
        } else if (coupon.metadata?.max_discount) {
          // Fallback to max_discount in metadata
          maxDiscount = parseFloat(coupon.metadata.max_discount);
        } else if (coupon.id === 'L0DshEg5' || code.toUpperCase() === 'WELCOME15') {
          // WELCOME15 has a $30 cap (hardcoded for legacy support)
          maxDiscount = 30;
        }
        
        if (maxDiscount > 0 && discountAmount > maxDiscount) {
          discountAmount = maxDiscount;
        }
        finalAmount = amount - discountAmount;
      } else if (coupon.amount_off) {
        // Fixed amount discount
        discountAmount = coupon.amount_off / 100; // Stripe stores in cents
        finalAmount = Math.max(0, amount - discountAmount);
      }

      // NOTE: We do NOT mark one-time codes as used here
      // Codes should only be marked as used AFTER successful payment
      // This validation is just checking if the code is valid
      // The code will be marked as used in finalizeCore when payment succeeds
      
      // Return validation result (code is valid, but not yet used)
      return NextResponse.json({
        valid: true,
        code: code.toUpperCase(),
        discountAmount: Math.round(discountAmount * 100) / 100,
        originalAmount: amount,
        finalAmount: Math.round(finalAmount * 100) / 100,
        isOneTime,
        coupon: {
          id: coupon.id,
          name: coupon.name,
          percent_off: coupon.percent_off,
          amount_off: coupon.amount_off ? coupon.amount_off / 100 : null,
        },
      });
```

---

## 5. Neon Schema and Sync Logic

### 5.1. What is your current Neon table schema for coupons / codes?

**Answer:**

**Two tables exist:**

#### 1. `discount_codes` table (global codes)

**Schema (from migration 010):**

```1:90:scripts/migrations/010_add_global_discount_code_fields.sql
-- Migration: Add fields to discount_codes table for global discount code management
-- This allows discount_codes to support max_uses, expiry, discount_cap, etc.

-- Add discount_type column (percent or dollar)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'discount_type'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN discount_type VARCHAR(20) DEFAULT 'percent';
  END IF;
END $$;

-- Add discount_value column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'discount_value'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN discount_value DECIMAL(10, 2);
  END IF;
END $$;

-- Add discount_cap column (for percentage discounts)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'discount_cap'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN discount_cap DECIMAL(10, 2);
  END IF;
END $$;

-- Add max_uses column (null = unlimited)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'max_uses'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN max_uses INTEGER;
  END IF;
END $$;

-- Add expires_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN expires_at TIMESTAMP;
  END IF;
END $$;

-- Add stripe_promotion_code_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'stripe_promotion_code_id'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN stripe_promotion_code_id VARCHAR(255);
  END IF;
END $$;

-- Add updated_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Update existing WELCOME15 code if it exists and doesn't have discount_type/value
UPDATE discount_codes 
SET 
  discount_type = 'percent',
  discount_value = 15,
  discount_cap = 30,
  updated_at = NOW()
WHERE code = 'WELCOME15' 
  AND (discount_type IS NULL OR discount_value IS NULL);
```

**Columns:**
- `id` (UUID, PRIMARY KEY)
- `code` (VARCHAR(50), UNIQUE)
- `discount_type` ('percent' or 'dollar')
- `discount_value` (DECIMAL)
- `discount_cap` (DECIMAL, nullable - for percent discounts)
- `stripe_coupon_id` (VARCHAR(255))
- `stripe_promotion_code_id` (VARCHAR(255))
- `is_active` (BOOLEAN)
- `max_uses` (INTEGER, nullable)
- `expires_at` (TIMESTAMP, nullable)
- `created_at`, `updated_at`

#### 2. `one_time_discount_codes` table

**Schema:**

```2:17:scripts/migrations/006_create_one_time_discount_codes.sql
CREATE TABLE IF NOT EXISTS one_time_discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'dollar')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  stripe_coupon_id VARCHAR(255),
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(100) -- Track who created it (e.g., 'admin', 'system')
);
```

**Key Differences:**
- `customer_id` (UUID, nullable) - can be customer-specific
- `used` (BOOLEAN) - tracks if code has been used
- `used_at` (TIMESTAMPTZ) - timestamp of usage
- `email_sent`, `email_sent_at` - tracks email notifications

**Both tables store Stripe IDs:**
- `stripe_coupon_id` - Links to Stripe Coupon object
- `stripe_promotion_code_id` - Links to Stripe PromotionCode object (global codes only)

### 5.2. When is Neon updated in response to payments?

**Answer:**

**Neon is updated on successful payment** in `finalizeCore.ts`:

1. **One-time codes**: Marked as `used = true` after payment succeeds
2. **Global codes**: Usage is read from Stripe (not synced to Neon)

**Code Reference - One-time Code Marking:**

```298:348:lib/bookings/finalizeCore.ts
    // Mark one-time discount code as used (inside transaction to ensure atomicity)
    // CRITICAL: The row is already locked by SELECT FOR UPDATE, so this update is safe
    if (oneTimeCodeId) {
      try {
        // Check if table exists before updating
        const tableCheck = await sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name = 'one_time_discount_codes'
          LIMIT 1
        `;
        const hasOneTimeTable = Array.isArray(tableCheck) 
          ? tableCheck.length > 0 
          : ((tableCheck as any)?.rows || []).length > 0;
        
        if (hasOneTimeTable) {
          const updateResult = await sql`
            UPDATE one_time_discount_codes 
            SET used = true, used_at = NOW(), updated_at = NOW()
            WHERE id = ${oneTimeCodeId} AND used = false
            RETURNING id, code, used, used_at
          `;
          const updatedRows = Array.isArray(updateResult) 
            ? updateResult 
            : (updateResult as any)?.rows || [];
          if (updatedRows.length === 0) {
            console.warn('[finalizeCore] Failed to mark one-time code as used - code may have already been used:', oneTimeCodeId);
          } else {
            console.log('[finalizeCore] Successfully marked one-time code as used:', {
              code: updatedRows[0].code,
              used: updatedRows[0].used,
              used_at: updatedRows[0].used_at,
            });
          }
          // Verify the update succeeded (row might have been updated by another transaction)
          const verifyResult = await sql`
            SELECT used FROM one_time_discount_codes WHERE id = ${oneTimeCodeId} LIMIT 1
          `;
          const verifyRows = Array.isArray(verifyResult) 
            ? verifyResult 
            : (verifyResult as any)?.rows || [];
          if (verifyRows.length > 0 && !verifyRows[0].used) {
            console.warn('[finalizeCore] One-time code was not marked as used - possible race condition');
          }
        }
      } catch (e) {
        // Non-critical - log but continue
        console.error('[finalizeCore] Failed to mark one-time code as used:', e);
      }
    }
```

**Code Reference - One-time Code Lookup (with Row Locking):**

```121:176:lib/bookings/finalizeCore.ts
          const codeUpper = discountCodeFromMetadata.toUpperCase();
          // CRITICAL: Use SELECT FOR UPDATE to lock the row and prevent concurrent usage
          // First check if code exists and is valid (with row lock)
          const oneTimeCodeResult = await sql`
            SELECT id, customer_id FROM one_time_discount_codes 
            WHERE code = ${codeUpper} 
              AND used = false
              AND (expires_at IS NULL OR expires_at > NOW())
            LIMIT 1
            FOR UPDATE
          `;
          const oneTimeRows = Array.isArray(oneTimeCodeResult) 
            ? oneTimeCodeResult 
            : (oneTimeCodeResult as any)?.rows || [];
          if (oneTimeRows.length > 0) {
            const codeRecord = oneTimeRows[0];
            // If code is customer-specific, verify customer matches
            if (codeRecord.customer_id) {
              if (!emailFromPi) {
                // No email in payment - log security issue but still mark as used to prevent reuse
                console.error('[finalizeCore] One-time code used without email (customer-specific code):', {
                  code: codeUpper,
                  codeCustomerId: codeRecord.customer_id,
                });
                // Still mark as used to prevent code reuse, but log security issue
                oneTimeCodeId = codeRecord.id;
              } else {
                const customerMatch = await sql`
                  SELECT id FROM customers 
                  WHERE id = ${codeRecord.customer_id} 
                    AND LOWER(email) = LOWER(${emailFromPi})
                  LIMIT 1
                `;
                const customerRows = Array.isArray(customerMatch) 
                  ? customerMatch 
                  : (customerMatch as any)?.rows || [];
                if (customerRows.length === 0) {
                  // Customer doesn't match - log security issue but still mark as used to prevent reuse
                  console.error('[finalizeCore] One-time code customer mismatch (security issue):', {
                    code: codeUpper,
                    codeCustomerId: codeRecord.customer_id,
                    paymentEmail: emailFromPi,
                  });
                  // Still mark as used to prevent code reuse, but log security issue
                  oneTimeCodeId = codeRecord.id;
                } else {
                  // Customer matches - safe to mark as used
                  oneTimeCodeId = codeRecord.id;
                }
              }
            } else {
              // Code is not customer-specific - safe to use
              oneTimeCodeId = codeRecord.id;
            }
          }
```

**Note**: No automatic sync from Stripe webhooks for coupon usage. Usage tracking for global codes is done by fetching `coupon.times_redeemed` and `promotionCode.times_redeemed` from Stripe when displaying admin dashboard.

### 5.3. Are you already using Stripe webhooks?

**Answer:**

**Yes, using webhooks:**

- **Endpoint**: `/api/webhooks/stripe`
- **Subscribed to**: `payment_intent.succeeded`
- **Handler**: Confirms Hapio booking on payment success

**Code Reference:**

```6:34:app/api/webhooks/stripe/route.ts
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('stripe-signature') || '';
    const rawBody = Buffer.from(await request.arrayBuffer());
    const event = constructWebhookEvent(rawBody, signature);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any;
        const bookingId = pi.metadata?.hapio_booking_id || null;
        if (bookingId) {
          try {
            await confirmBooking(bookingId, { isTemporary: false });
          } catch (e) {
            console.error('[Stripe Webhook] Booking finalize failed', e);
          }
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
```

**Note**: Webhooks are NOT used for coupon usage tracking. Coupon usage is tracked manually in Neon (for one-time codes) or read from Stripe (for global codes).

---

## 6. Error Details When Creating Coupon Codes

### 6.1. When you say "we are having errors when trying to create the coupon codes"

**Answer:**

Errors are returned **directly from Stripe** when calling `/v1/coupons` or `/v1/promotion_codes`.

**Code Reference - Error Handling:**

```253:278:app/api/admin/global-discount-codes/route.ts
    } catch (promoError: any) {
      console.error('[Create Global Discount Code] Promotion code creation failed:', {
        error: promoError.message,
        code: promoError.code,
        param: promoError.param,
        type: promoError.type,
        couponId: couponId,
      });
      
      // If promotion code creation fails, delete the coupon we just created to avoid orphaned resources
      try {
        await stripe.coupons.del(couponId);
        console.log('[Create Global Discount Code] Cleaned up orphaned coupon:', couponId);
      } catch (delError) {
        console.error('[Create Global Discount Code] Failed to clean up coupon after promotion code error:', delError);
      }
      
      // Return detailed error
      return NextResponse.json(
        { 
          error: 'Failed to create promotion code', 
          details: promoError.message || 'Unknown error',
          stripeError: promoError.code || promoError.type,
        },
        { status: 500 }
      );
    }
```

### 6.2. For each failing case, what is the exact HTTP status code and error?

**Answer:**

Based on the code structure, likely errors include:

1. **Missing `duration` parameter**: Stripe requires `duration: 'once'` for one-time payments
2. **Promotion code creation failures**: After coupon creation succeeds, promotion code creation may fail
3. **Invalid coupon ID format**: Coupon ID must be a valid string

**Code Reference - Coupon ID Validation:**

```217:229:app/api/admin/global-discount-codes/route.ts
    // CRITICAL: Ensure coupon.id is a string and properly formatted
    const couponId = String(coupon.id).trim();
    if (!couponId || couponId.length === 0) {
      // Clean up coupon if ID is invalid
      try {
        await stripe.coupons.del(coupon.id);
      } catch (delError) {
        console.error('[Create Global Discount Code] Failed to clean up coupon with invalid ID:', delError);
      }
      return NextResponse.json(
        { error: 'Invalid coupon ID from Stripe' },
        { status: 500 }
      );
    }
```

### 6.3. Are the errors specific to one-time codes, global codes, percent vs amount, or random?

**Answer:**

Based on the code, errors are likely:

- **Random/all types**: The error handling is generic and applies to both one-time and global codes
- **Promotion code creation**: This is specific to global codes (one-time codes don't create promotion codes)
- **Coupon creation**: Can fail for both types if `duration: 'once'` is missing or invalid parameters

**Code Reference - Cleanup Logic (Indicates Common Failure Point):**

```262:268:app/api/admin/global-discount-codes/route.ts
      // If promotion code creation fails, delete the coupon we just created to avoid orphaned resources
      try {
        await stripe.coupons.del(couponId);
        console.log('[Create Global Discount Code] Cleaned up orphaned coupon:', couponId);
      } catch (delError) {
        console.error('[Create Global Discount Code] Failed to clean up coupon after promotion code error:', delError);
      }
```

---

## 7. What You Ultimately Want (Given PaymentIntent)

### 7.1. For each successful payment using a coupon, what do you want to be true?

**Answer:**

#### PaymentIntent reflects:

✅ **The discounted amount only** (amount already reduced)
- Currently: ✅ Implemented - Amount is pre-calculated with discount

✅ **Metadata includes `coupon_code: "WELCOME10"` and/or IDs**
- Currently: ✅ Implemented - Metadata has `discountCode` string

**Code Reference - Current Implementation:**

```139:149:app/api/payments/create-intent/route.ts
      metadata: {
        service_id: svc.id,
        service_slug: svc.slug,
        hapio_service_id: hapioServiceId ?? '',
        slot_start: slotStart,
        slot_end: slotEnd,
        timezone: timezone ?? '',
        hapio_booking_id: bookingId ?? '',
        discountCode: discountCode ? discountCode.toUpperCase() : '',
      },
```

#### Neon reflects:

✅ **Incremented usage for that coupon / promotion code**
- Currently: ⚠️ Partial - One-time codes marked as `used = true`, but global codes usage is read from Stripe (not synced to Neon)

✅ **Status (active/exhausted) updated when max usage is hit**
- Currently: ⚠️ Partial - One-time codes have `used` flag, but global codes status is determined by reading Stripe `times_redeemed` vs `max_uses`

**Code Reference - Usage Tracking:**

```62:103:app/api/admin/global-discount-codes/route.ts
    // For each code, get usage count from Stripe
    const codesWithUsage = await Promise.all(
      codes.map(async (code) => {
        let usageCount = 0;
        let timesRedeemed = 0;

        if (code.stripe_coupon_id) {
          try {
            const coupon = await stripe.coupons.retrieve(code.stripe_coupon_id);
            timesRedeemed = coupon.times_redeemed || 0;
            
            // Also check promotion codes if they exist
            if (coupon.id) {
              const promotionCodes = await stripe.promotionCodes.list({
                coupon: coupon.id,
                limit: 100,
              });
              
              // Sum up times_redeemed from all promotion codes
              usageCount = promotionCodes.data.reduce((sum, pc) => {
                return sum + (pc.times_redeemed || 0);
              }, 0);
              
              // If no promotion codes, use coupon times_redeemed
              if (usageCount === 0) {
                usageCount = timesRedeemed;
              }
            } else {
              usageCount = timesRedeemed;
            }
          } catch (e) {
            console.error(`[Global Discount Codes] Error fetching Stripe usage for ${code.code}:`, e);
          }
        }

        return {
          ...code,
          usage_count: usageCount,
          times_redeemed: timesRedeemed,
        };
      })
    );
```

### 7.2. Are you OK with not using Stripe coupons/promotion codes at all?

**Answer:**

**No, you explicitly want actual Stripe coupons/promotion codes created and managed in Stripe and mirrored in Neon.**

**Current Implementation:**
- ✅ Creates Stripe Coupon objects
- ✅ Creates Stripe PromotionCode objects (for global codes)
- ✅ Stores Stripe IDs in Neon (`stripe_coupon_id`, `stripe_promotion_code_id`)
- ✅ Uses Stripe objects for validation and usage tracking
- ⚠️ But doesn't apply them directly to PaymentIntent (manual amount calculation)

**Why this approach?**
- PaymentIntent doesn't support direct coupon application (only Checkout Sessions and Invoices do)
- Stripe objects provide reporting/analytics capabilities
- Neon is source of truth for business logic, Stripe is source of truth for payment processing

**Code Reference - Stripe Object Storage:**

```298:324:app/api/admin/global-discount-codes/route.ts
    // Insert into database - wrap in try-catch to handle DB failures
    try {
      await sql`
        INSERT INTO discount_codes (
          code,
          discount_type,
          discount_value,
          discount_cap,
          stripe_coupon_id,
          stripe_promotion_code_id,
          is_active,
          max_uses,
          expires_at,
          created_at,
          updated_at
        ) VALUES (
          ${codeUpper},
          ${discountType},
          ${discountValue},
          ${discountCap || null},
          ${couponId},
          ${promotionCode.id},
          ${isActive},
          ${maxUses || null},
          ${expiresAt},
          NOW(),
          NOW()
        )
      `;
      console.log('[Create Global Discount Code] Successfully inserted into database:', codeUpper);
```

---

## 8. Operational / Admin Requirements

### 8.1. From your custom admin dashboard, what should an admin be able to do?

**Answer:**

✅ **Create new codes** (one-time / global) with % or $ off
- See: `POST /api/admin/global-discount-codes`
- See: `POST /api/admin/discount-codes/generate` (for one-time codes)

✅ **See current usages / remaining uses**
- See: `GET /api/admin/global-discount-codes` - returns usage counts from Stripe
- See: `GET /api/admin/global-discount-codes/[id]/usage` - detailed usage stats

✅ **Deactivate a code**
- See: `PATCH /api/admin/global-discount-codes/[id]` - can set `is_active = false`
- See: `PATCH /api/admin/discount-codes/[id]` - can update one-time codes

✅ **Change discount value or limit after creation**
- See: `PATCH /api/admin/discount-codes/[id]` - updates discount value/type/cap
- Note: Only for unused codes (used codes cannot be edited)

**Code Reference - Admin Update:**

```18:210:app/api/admin/discount-codes/[id]/route.ts
// PATCH /api/admin/discount-codes/[id] - Update discount code
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const body = await request.json();
    const { discountType, discountValue, discountCap, expiresInDays } = body;

    if (!discountType || !['percent', 'dollar'].includes(discountType)) {
      return NextResponse.json(
        { error: 'discountType must be "percent" or "dollar"' },
        { status: 400 }
      );
    }

    if (!discountValue || discountValue <= 0) {
      return NextResponse.json(
        { error: 'discountValue must be greater than 0' },
        { status: 400 }
      );
    }

    if (discountType === 'percent' && discountValue > 100) {
      return NextResponse.json(
        { error: 'Percentage discount cannot exceed 100%' },
        { status: 400 }
      );
    }

    // Validate discount cap
    if (discountCap !== undefined && discountCap !== null) {
      if (discountType !== 'percent') {
        return NextResponse.json(
          { error: 'Discount cap can only be set for percentage discounts' },
          { status: 400 }
        );
      }
      if (discountCap <= 0) {
        return NextResponse.json(
          { error: 'Discount cap must be greater than 0' },
          { status: 400 }
        );
      }
    }

    const sql = getSqlClient();

    // Fetch existing code
    const codeResult = await sql`
      SELECT id, code, discount_type, discount_value, discount_cap, stripe_coupon_id, used, expires_at
      FROM one_time_discount_codes
      WHERE id = ${codeId}
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const existingCode = codeRows[0];

    // Don't allow editing used codes
    if (existingCode.used) {
      return NextResponse.json(
        { error: 'Cannot edit a discount code that has already been used' },
        { status: 400 }
      );
    }

    // Calculate new expiration date
    let newExpiresAt = existingCode.expires_at;
    if (expiresInDays !== undefined && expiresInDays !== null) {
      if (expiresInDays > 0) {
        newExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        newExpiresAt = null;
      }
    }

    // Update Stripe coupon if discount value or type changed
    if (existingCode.stripe_coupon_id && 
        (existingCode.discount_type !== discountType || 
         Number(existingCode.discount_value) !== discountValue)) {
      const oldCouponId = existingCode.stripe_coupon_id;
      let newCouponId: string | null = null;
      
      try {
        // Create new coupon FIRST (before deleting old one to avoid orphaned state)
        const couponName = `One-time: ${existingCode.code}`;
        let coupon: Stripe.Coupon;
        if (discountType === 'percent') {
          const couponParams: Stripe.CouponCreateParams = {
            name: couponName,
            duration: 'once',
            percent_off: Math.round(discountValue),
            metadata: {
              one_time_code: existingCode.code,
              discount_type: discountType,
            },
          };
          if (discountCap) {
            couponParams.metadata = {
              ...couponParams.metadata,
              discount_cap: String(discountCap),
            };
          }
          coupon = await stripe.coupons.create(couponParams);
        } else {
          coupon = await stripe.coupons.create({
            name: couponName,
            duration: 'once',
            amount_off: Math.round(discountValue * 100),
            currency: 'usd',
            metadata: {
              one_time_code: existingCode.code,
              discount_type: discountType,
            },
          });
        }
        
        newCouponId = String(coupon.id).trim();
        if (!newCouponId || newCouponId.length === 0) {
          throw new Error('Invalid coupon ID returned from Stripe');
        }
        
        // Update database with new coupon ID
        await sql`
          UPDATE one_time_discount_codes
          SET 
            discount_type = ${discountType},
            discount_value = ${discountValue},
            discount_cap = ${discountCap || null},
            expires_at = ${newExpiresAt},
            stripe_coupon_id = ${newCouponId},
            updated_at = NOW()
          WHERE id = ${codeId}
        `;
        
        // Only delete old coupon after DB update succeeds
        try {
          await stripe.coupons.del(oldCouponId);
          console.log('[Update Discount Code] Successfully replaced old coupon:', oldCouponId);
        } catch (delError: any) {
          // Log but don't fail - old coupon might already be deleted
          console.warn('[Update Discount Code] Failed to delete old coupon (non-critical):', delError.message);
        }
      } catch (stripeError: any) {
        console.error('[Update Discount Code] Stripe coupon update failed:', {
          error: stripeError.message,
          code: stripeError.code,
          type: stripeError.type,
        });
        
        // If new coupon was created but DB update failed, clean it up
        if (newCouponId) {
          try {
            await stripe.coupons.del(newCouponId);
            console.log('[Update Discount Code] Cleaned up orphaned new coupon:', newCouponId);
          } catch (cleanupError) {
            console.error('[Update Discount Code] Failed to clean up orphaned coupon:', cleanupError);
          }
        }
        
        return NextResponse.json(
          { error: 'Failed to update Stripe coupon', details: stripeError.message },
          { status: 500 }
        );
      }
    } else {
      // Just update database fields
      await sql`
        UPDATE one_time_discount_codes
        SET 
          discount_type = ${discountType},
          discount_value = ${discountValue},
          discount_cap = ${discountCap || null},
          expires_at = ${newExpiresAt},
          updated_at = NOW()
        WHERE id = ${codeId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Update Discount Code] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
```

### 8.2. If an admin changes a coupon in the dashboard, should it propagate to Stripe?

**Answer:**

**Yes, changes propagate to Stripe.**

**Current Implementation:**
- When admin updates discount value/type, system creates a **new Stripe coupon** and deletes the old one
- This ensures Stripe objects stay in sync with Neon changes
- Stripe is not purely a reflection of DB - it's actively managed, but Neon is source of truth for business logic

**Code Reference - Stripe Sync on Update:**

```99:187:app/api/admin/discount-codes/[id]/route.ts
    // Update Stripe coupon if discount value or type changed
    if (existingCode.stripe_coupon_id && 
        (existingCode.discount_type !== discountType || 
         Number(existingCode.discount_value) !== discountValue)) {
      const oldCouponId = existingCode.stripe_coupon_id;
      let newCouponId: string | null = null;
      
      try {
        // Create new coupon FIRST (before deleting old one to avoid orphaned state)
        const couponName = `One-time: ${existingCode.code}`;
        let coupon: Stripe.Coupon;
        if (discountType === 'percent') {
          const couponParams: Stripe.CouponCreateParams = {
            name: couponName,
            duration: 'once',
            percent_off: Math.round(discountValue),
            metadata: {
              one_time_code: existingCode.code,
              discount_type: discountType,
            },
          };
          if (discountCap) {
            couponParams.metadata = {
              ...couponParams.metadata,
              discount_cap: String(discountCap),
            };
          }
          coupon = await stripe.coupons.create(couponParams);
        } else {
          coupon = await stripe.coupons.create({
            name: couponName,
            duration: 'once',
            amount_off: Math.round(discountValue * 100),
            currency: 'usd',
            metadata: {
              one_time_code: existingCode.code,
              discount_type: discountType,
            },
          });
        }
        
        newCouponId = String(coupon.id).trim();
        if (!newCouponId || newCouponId.length === 0) {
          throw new Error('Invalid coupon ID returned from Stripe');
        }
        
        // Update database with new coupon ID
        await sql`
          UPDATE one_time_discount_codes
          SET 
            discount_type = ${discountType},
            discount_value = ${discountValue},
            discount_cap = ${discountCap || null},
            expires_at = ${newExpiresAt},
            stripe_coupon_id = ${newCouponId},
            updated_at = NOW()
          WHERE id = ${codeId}
        `;
        
        // Only delete old coupon after DB update succeeds
        try {
          await stripe.coupons.del(oldCouponId);
          console.log('[Update Discount Code] Successfully replaced old coupon:', oldCouponId);
        } catch (delError: any) {
          // Log but don't fail - old coupon might already be deleted
          console.warn('[Update Discount Code] Failed to delete old coupon (non-critical):', delError.message);
        }
      } catch (stripeError: any) {
        console.error('[Update Discount Code] Stripe coupon update failed:', {
          error: stripeError.message,
          code: stripeError.code,
          type: stripeError.type,
        });
        
        // If new coupon was created but DB update failed, clean it up
        if (newCouponId) {
          try {
            await stripe.coupons.del(newCouponId);
            console.log('[Update Discount Code] Cleaned up orphaned new coupon:', newCouponId);
          } catch (cleanupError) {
            console.error('[Update Discount Code] Failed to clean up orphaned coupon:', cleanupError);
          }
        }
        
        return NextResponse.json(
          { error: 'Failed to update Stripe coupon', details: stripeError.message },
          { status: 500 }
        );
      }
    }
```

---

## Summary & Key Insights

### Current Flow Architecture

1. **User enters discount code** → validates via `/api/payments/validate-discount`
2. **Validation retrieves Stripe coupon**, calculates discount manually
3. **Frontend creates PaymentIntent** with pre-calculated discounted amount
4. **PaymentIntent metadata** includes `discountCode` string
5. **On payment success**, one-time codes marked as `used` in Neon

### Key Design Decisions

✅ **Correct Approach**: Since PaymentIntent doesn't support direct coupon application (only Checkout Sessions and Invoices do), your manual calculation approach is the right solution.

✅ **Hybrid Model**: You create Stripe coupons/promotion codes for reporting/analytics, but apply discounts manually to PaymentIntent amounts.

✅ **Source of Truth**: Neon is source of truth for business logic, Stripe is source of truth for payment processing and usage tracking.

### Potential Issues & Recommendations

1. **Stripe Coupon/Promotion Code Usage Tracking**: Currently, global codes usage is read from Stripe but not synced to Neon. Consider adding a `usage_count` column to `discount_codes` table and updating it on successful payments.

2. **Error Handling**: The code has good cleanup logic for orphaned coupons, but ensure all error paths are covered.

3. **Race Conditions**: One-time codes use `SELECT FOR UPDATE` to prevent race conditions - this is good! Ensure this pattern is used consistently.

4. **Webhook Integration**: Consider adding webhook handlers for coupon-related events if you want real-time sync between Stripe and Neon.

---

## Related Files Reference

### Core Files
- `lib/stripeClient.ts` - Stripe initialization and helper functions
- `app/api/payments/create-intent/route.ts` - PaymentIntent creation
- `app/api/payments/validate-discount/route.ts` - Discount code validation
- `app/_components/CustomPaymentModal.tsx` - Frontend payment form with discount code input
- `lib/bookings/finalizeCore.ts` - Payment finalization and one-time code marking

### Admin Files
- `app/api/admin/global-discount-codes/route.ts` - Global code CRUD operations
- `app/api/admin/discount-codes/[id]/route.ts` - One-time code update/delete
- `app/api/admin/discount-codes/generate/route.ts` - One-time code generation

### Database Migrations
- `scripts/migrations/006_create_one_time_discount_codes.sql` - One-time codes table
- `scripts/migrations/010_add_global_discount_code_fields.sql` - Global codes enhancements

### Webhooks
- `app/api/webhooks/stripe/route.ts` - Stripe webhook handler

---

*Last Updated: Based on codebase analysis as of current implementation*
*Documentation Version: 1.0*

