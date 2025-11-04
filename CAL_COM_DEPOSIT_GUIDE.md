# Cal.com Deposit Setup Guide

## ⚠️ Important Limitation

**Cal.com does NOT natively support deposits or partial payments.** They require full payment at booking time.

However, there are workarounds to achieve a deposit system:

---

## 💡 Option 1: Set Event Price to Deposit Amount (Recommended)

**How it works:**
- Set the Cal.com event price to your desired deposit amount (e.g., 50% of full price)
- Customer pays deposit when booking
- Collect remaining balance at appointment or via separate invoice

**Pros:**
- Simple to implement
- Works with existing Cal.com + Stripe setup
- No code changes needed

**Cons:**
- Need to manually track and collect remaining balance
- Customer sees deposit amount, not full price during booking

### Implementation

#### Automatic (Using Script)
```bash
# Update all events to 50% deposit (default)
npm run update-cal-deposits

# Or specify custom percentage (e.g., 30% deposit)
npm run update-cal-deposits -- 30
```

The script will:
- Calculate deposit as percentage of full price
- Minimum deposit: $20
- Update all Cal.com events with deposit amounts
- Process one at a time with 8-second delays

#### Manual (In Cal.com UI)
1. Go to https://cal.com
2. Navigate to Event Types
3. For each event:
   - Click to edit
   - Change price to deposit amount (e.g., $75 for a $150 service = 50% deposit)
   - Save

---

## 💡 Option 2: Custom Payment Flow (More Complex)

**How it works:**
1. Collect deposit on your website via Stripe
2. Redirect to Cal.com with free booking (price = $0)
3. Collect remaining balance later

**Pros:**
- Full control over payment flow
- Can show full price vs deposit clearly
- Can add custom payment logic

**Cons:**
- Requires custom code implementation
- More complex to maintain
- Need to handle payment tracking

### Implementation

Would require:
- Stripe payment form on your site
- Custom booking flow
- Payment tracking system
- Integration with Cal.com API

---

## 📊 Deposit Calculation Examples

### 50% Deposit (Default)
- **Aura facial ($150)** → Deposit: **$75**
- **HydraFacial ($135)** → Deposit: **$67.50** → **$68** (rounded)
- **Biorepeel ($230)** → Deposit: **$115**

### 30% Deposit
- **Aura facial ($150)** → Deposit: **$45**
- **HydraFacial ($135)** → Deposit: **$40.50** → **$41** (rounded)
- **Brow Tint ($20)** → Deposit: **$20** (minimum)

### 40% Deposit
- **Aura facial ($150)** → Deposit: **$60**
- **Microneedling ($170)** → Deposit: **$68**

---

## 🔧 Using the Deposit Update Script

### Basic Usage
```bash
# Update all events to 50% deposit (default)
npm run update-cal-deposits
```

### Custom Deposit Percentage
```bash
# 30% deposit
npm run update-cal-deposits -- 30

# 40% deposit
npm run update-cal-deposits -- 40

# 25% deposit
npm run update-cal-deposits -- 25
```

### What It Does
1. Reads all services from `services.json`
2. Calculates deposit amount based on percentage
3. Updates each Cal.com event with deposit price
4. Processes one API call at a time (8-second delays)
5. Shows progress and summary

---

## 📝 Best Practices

### 1. Set Clear Expectations
- Update your website to show: "Deposit required at booking"
- Make it clear remaining balance is due at appointment
- Example: "Book now with $75 deposit (50% of $150)"

### 2. Track Remaining Balance
- Use a spreadsheet or CRM to track:
  - Booking date
  - Deposit paid
  - Remaining balance
  - Appointment date

### 3. Collect Remaining Balance
- **At appointment:** Cash, card, or invoice
- **Before appointment:** Send invoice via email
- **After appointment:** Send invoice for any add-ons

### 4. Update Event Descriptions
Add to each event description in Cal.com:
```
"Deposit of $[amount] required at booking. Remaining balance of $[amount] due at appointment."
```

---

## 🎯 Recommended Setup

### Step 1: Decide Deposit Percentage
- **50%** - Standard, balances risk
- **30-40%** - Lower barrier to entry
- **25%** - Very low barrier (good for first-time customers)

### Step 2: Update Events
```bash
# Run the script with your chosen percentage
npm run update-cal-deposits -- 50
```

### Step 3: Update Website Copy
Update booking pages to mention:
- "Deposit required at booking"
- "Remaining balance due at appointment"

### Step 4: Update Event Descriptions
In Cal.com UI, add deposit info to each event description.

---

## 💰 Example: 50% Deposit Setup

**Before:**
- Event Price: $150 (full amount)
- Customer pays: $150 at booking

**After:**
- Event Price: $75 (50% deposit)
- Customer pays: $75 at booking
- Remaining: $75 due at appointment

---

## ⚠️ Important Notes

1. **Cal.com limitation:** Cannot split payments automatically
2. **Manual tracking:** You'll need to track remaining balances
3. **Minimum deposit:** Script enforces $20 minimum
4. **Individual adjustments:** Can manually change individual events in Cal.com UI

---

## 🔄 Reverting to Full Price

If you want to go back to full payment:

```bash
# Update all events back to full price
npm run update-cal-events
```

This will restore prices from `services.json` (full amounts).

---

## 📞 Need Help?

- **Cal.com Support:** https://i.cal.com/support
- **Cal.com Docs:** https://docs.cal.com
- **Stripe Docs:** https://stripe.com/docs/payments

