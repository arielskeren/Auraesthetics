# Payment System Integration - Strategy 2: Discount Codes (Stripe Coupons)

## Overview
Implement discount code system using Stripe Coupons for robust validation, usage tracking, and automatic application.

## Why Stripe Coupons (Option B)

**Pros:**
- ✅ Built-in validation and expiration handling
- ✅ Automatic usage limit tracking
- ✅ Works seamlessly with Stripe Payment Intents
- ✅ Can set minimum purchase amounts
- ✅ Supports percentage and fixed-amount discounts
- ✅ No additional cost (part of Stripe)
- ✅ Dashboard UI for managing coupons

**Cons:**
- ❌ Requires Stripe account setup
- ❌ Need to sync coupon IDs with database

---

## Implementation Plan

### Step 1: Create Coupons in Stripe Dashboard

1. Go to Stripe Dashboard → Products → Coupons
2. Create coupons for each discount code:

**WELCOME15**
- Percent off: 15%
- Maximum discount: $30
- Currency: USD
- Duration: Once
- Redemption limit: Per customer (1 per customer)

**FIRST50**
- Amount off: $50
- Currency: USD
- Duration: Once
- Redemption limit: Per customer (1 per customer)

**Add more as needed...**

### Step 2: Store Coupon IDs in Database

**Option A: Neon Database (Recommended)**
Store in `discount_codes` table:
```sql
INSERT INTO discount_codes (code, stripe_coupon_id, description, is_active)
VALUES 
  ('WELCOME15', '15OFF', 'Welcome discount - 15% off up to $30', true),
  ('FIRST50', '50OFF', 'First-time customer - $50 off', true);
```

**Option B: Environment Variables (Simple)**
```env
STRIPE_COUPON_WELCOME15=15OFF
STRIPE_COUPON_FIRST50=50OFF
```

### Step 3: Validate Coupon API

**File**: `app/api/payments/validate-discount/route.ts`

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const { code, amount } = await request.json();
  
  try {
    // Retrieve coupon from Stripe
    const coupon = await stripe.coupons.retrieve(code.toUpperCase());
    
    // Check if coupon is valid
    if (!coupon.valid) {
      return Response.json({ 
        valid: false, 
        error: 'Coupon is not valid' 
      });
    }
    
    // Calculate discount
    let discountAmount = 0;
    if (coupon.percent_off) {
      discountAmount = (amount * coupon.percent_off) / 100;
      
      // Apply maximum discount if set
      if (coupon.metadata?.max_discount) {
        discountAmount = Math.min(
          discountAmount, 
          parseFloat(coupon.metadata.max_discount)
        );
      }
    } else if (coupon.amount_off) {
      discountAmount = coupon.amount_off / 100; // Convert cents to dollars
    }
    
    const finalAmount = Math.max(0, amount - discountAmount);
    
    return Response.json({
      valid: true,
      discountAmount,
      finalAmount,
      coupon: {
        id: coupon.id,
        name: coupon.name,
        percentOff: coupon.percent_off,
        amountOff: coupon.amount_off
      }
    });
    
  } catch (error) {
    return Response.json({ 
      valid: false, 
      error: 'Invalid coupon code' 
    });
  }
}
```

### Step 4: Apply Coupon to Payment Intent

**File**: `app/api/payments/create-intent/route.ts`

```typescript
// After validating discount code
const paymentIntentData: Stripe.PaymentIntentCreateParams = {
  amount: finalAmount * 100, // Convert to cents
  currency: 'usd',
  // ... other params
};

// If coupon is valid, apply it
if (discountCode && couponValid) {
  paymentIntentData.discounts = [{
    coupon: couponId
  }];
}

const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
```

---

## Integration with Custom Payment Modal

**File**: `app/_components/CustomPaymentModal.tsx`

```typescript
const handleDiscountCodeChange = async (code: string) => {
  if (!code) {
    setDiscountCode(null);
    setFinalAmount(baseAmount);
    return;
  }
  
  const response = await fetch('/api/payments/validate-discount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      code, 
      amount: baseAmount 
    })
  });
  
  const data = await response.json();
  
  if (data.valid) {
    setDiscountCode(code);
    setDiscountAmount(data.discountAmount);
    setFinalAmount(data.finalAmount);
  } else {
    setDiscountError(data.error || 'Invalid discount code');
  }
};
```

---

## Managing Coupons

### Create New Coupon via API (Optional)

**File**: `app/api/admin/coupons/create/route.ts`

```typescript
export async function POST(request: Request) {
  const { code, percentOff, amountOff, maxDiscount, description } = await request.json();
  
  const coupon = await stripe.coupons.create({
    id: code.toUpperCase(), // Use code as coupon ID
    name: description,
    percent_off: percentOff,
    amount_off: amountOff ? amountOff * 100 : undefined, // Convert to cents
    currency: 'usd',
    duration: 'once',
    max_redemptions: null, // Unlimited
    metadata: {
      max_discount: maxDiscount?.toString(),
      description
    }
  });
  
  // Store in database
  await db.query(
    'INSERT INTO discount_codes (code, stripe_coupon_id, description) VALUES ($1, $2, $3)',
    [code.toUpperCase(), coupon.id, description]
  );
  
  return Response.json({ success: true, coupon });
}
```

### List Active Coupons

**File**: `app/api/admin/coupons/list/route.ts`

```typescript
export async function GET() {
  const coupons = await stripe.coupons.list({ limit: 100 });
  
  return Response.json({ coupons: coupons.data });
}
```

---

## Usage Tracking

Stripe automatically tracks:
- Total redemptions
- Redemptions per customer
- Expiration dates
- Valid/invalid status

Query via Stripe API:
```typescript
const coupon = await stripe.coupons.retrieve('WELCOME15');
console.log(coupon.times_redeemed); // Total redemptions
```

---

## Testing

### Test Coupons
Create test coupons in Stripe Test Mode:
- Use test card: `4242 4242 4242 4242`
- Test coupon codes
- Verify discount calculation
- Test expiration handling

### Test Scenarios
- [ ] Valid coupon applies correctly
- [ ] Invalid coupon shows error
- [ ] Expired coupon is rejected
- [ ] Maximum discount limit is enforced
- [ ] Per-customer limit works
- [ ] Percentage discount calculates correctly
- [ ] Fixed amount discount calculates correctly

---

## Best Practices

1. **Use uppercase codes** for consistency
2. **Store coupon IDs** in database for easy lookup
3. **Set expiration dates** for time-limited promotions
4. **Use metadata** to store additional info (max discount, description)
5. **Monitor usage** via Stripe dashboard
6. **Validate before creating payment intent** to avoid errors
7. **Handle errors gracefully** with user-friendly messages

---

## Migration from Existing Discount Codes

If you have existing discount codes in Brevo or elsewhere:

1. Create corresponding Stripe coupons
2. Update database with Stripe coupon IDs
3. Update validation logic to use Stripe API
4. Test thoroughly before going live
5. Keep old system active during transition period

