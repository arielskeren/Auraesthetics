# Cal.com Implementation Guide

Complete guide for integrating Cal.com + Stripe booking system into Aura Wellness Aesthetics.

---

## 🎯 What We're Building

A booking system that:
- ✅ Syncs with Outlook calendar
- ✅ Sends email reminders (automatic)
- ✅ Accepts Stripe payments
- ✅ Prevents double bookings
- ✅ Custom intake forms for each service
- ✅ Mobile-responsive

---

## 🏗️ Architecture Overview

```
Client Flow:
1. User visits /book
2. Selects service → sees pricing
3. Enters payment info → Stripe charge
4. Redirect to Cal.com → picks time
5. Confirmation email from Cal.com
```

---

## 🛠️ Tech Stack Additions

### New Services
- **Cal.com** - Scheduling & calendar sync
- **Stripe** - Payment processing
- **Cal.com API** - Automated event creation

### Existing Services
- **Brevo** - Email notifications (already integrated)
- **Next.js** - Frontend framework (already have)
- **Vercel** - Hosting (already deployed)

---

## 📋 Cal.com Setup

### Step 1: Create Account
1. Go to https://cal.com
2. Sign up with Google/Microsoft
3. Complete onboarding
4. **Important:** Choose **Free Plan** (upgrade later if needed)

### Step 2: Connect Calendar (Outlook)
1. Go to Settings → Connected Calendars
2. Click "Add Calendar"
3. Select "Microsoft 365 / Outlook"
4. Authenticate with Microsoft
5. Select calendar to sync
6. Enable "Block out times" option

### Step 3: Connect Stripe
1. Go to Settings → App → Stripe
2. Click "Install"
3. Connect your Stripe account
   - Sign up at https://stripe.com if needed
4. Verify connection (test mode is fine initially)

### Step 4: Create Event Types

You have **two options:**

#### Option A: Duration-Based Events (Easiest - 30 minutes)

Create 4-5 events by time slot:
1. "30 Minute Treatment"
   - Duration: 30 minutes
   - Price: $0 (we'll handle pricing on our site)
   - Intake questions: "Which service?" (dropdown with your services)
2. "45 Minute Treatment"
3. "60-75 Minute Treatment"
4. "90 Minute Treatment"

**Pros:** Fast setup, flexible
**Cons:** Need intake questions to identify exact service

#### Option B: Per-Service Events (More Work - 2 hours)

Create individual events for each service from `services.json`:
- Signature Aura Facial
- HydraFacial
- Brow Lamination
- etc.

**Pros:** Clearer booking flow
**Cons:** Manual setup or requires API script

---

## 💳 Stripe Setup

### Step 1: Create Account
1. Go to https://stripe.com
2. Sign up
3. Complete business verification
4. Activate account (Stripe will guide you)

### Step 2: Get API Keys
1. Dashboard → Developers → API Keys
2. Copy:
   - **Publishable Key** (starts with `pk_`)
   - **Secret Key** (starts with `sk_`)
3. Keep secret key secure!

### Step 3: Add to Project
Create `.env.local` (or add to existing):
```env
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Existing Brevo
BREVO_API_KEY=xkeysib-...
BREVO_LIST_ID=3
```

### Step 4: Add to Vercel
1. Go to https://vercel.com → Your Project → Settings → Environment Variables
2. Add all three Stripe variables
3. Redeploy

---

## 🔧 Implementation Options

### Option 1: Simple Redirect (Easiest - 2 hours)

**Flow:**
1. User selects service on your site
2. Clicks "Book Now"
3. Redirect to Cal.com booking page
4. Cal.com handles: time selection, payment, confirmation
5. Redirect back to your site

**Pros:** Very fast to implement
**Cons:** Less seamless, leaves your site

**Code:**
```typescript
// app/book/page.tsx
export default function BookPage() {
  const handleBook = (service) => {
    const calLink = `https://cal.com/your-username/${service.eventSlug}`;
    window.location.href = calLink;
  };
  
  return <ServiceCard onClick={handleBook} />;
}
```

**Time:** 2 hours

---

### Option 2: Embedded Widget (Better UX - 4 hours)

**Flow:**
1. User selects service on your site
2. Payment happens on your site (Stripe Elements)
3. Cal.com widget opens in modal
4. User books time slot
5. Confirmation

**Pros:** Stays on your site, better UX
**Cons:** Need to integrate Stripe + Cal.com

**Code:**
```typescript
// Install Cal.com embed
npm install @calcom/embed-react

// Use in component
import Cal, { getCalApi } from "@calcom/embed-react";

function BookingWidget() {
  return (
    <Cal
      calLink="your-username/60-minute-treatment"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    />
  );
}
```

**Time:** 4 hours

---

### Option 3: Full Custom Integration (Most Control - 8 hours)

**Flow:**
1. Everything on your site
2. Stripe payment first
3. Use Cal.com API to create booking
4. Sync to your calendar
5. Send confirmations

**Pros:** Complete control, best UX
**Cons:** More complex, requires API knowledge

**Code:**
```typescript
// app/api/create-booking/route.ts
export async function POST(request) {
  const { service, date, time, paymentIntentId } = await request.json();
  
  // Verify payment with Stripe
  const payment = await stripe.paymentIntents.retrieve(paymentIntentId);
  
  if (payment.status === 'succeeded') {
    // Create Cal.com booking via API
    await fetch('https://api.cal.com/v1/bookings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CAL_COM_API_KEY}`,
      },
      body: JSON.stringify({
        eventTypeId: service.calEventTypeId,
        start: `${date}T${time}:00`,
      }),
    });
  }
}
```

**Time:** 8 hours

---

## 📊 Recommended Approach

### For Speed: Option 1 (Simple Redirect)
- Get booking live in 2 hours
- Works great with minimal code
- Can upgrade to Option 2 later

### For Long-term: Option 2 (Embedded)
- Best user experience
- Still relatively simple
- Professional look

### For Maximum Control: Option 3 (Full Custom)
- If you need specific features
- More maintenance required

---

## 💰 Pricing Integration

### Option A: Cal.com Manages Payment
- Set price in each event type
- Stripe processes payment
- Cal.com handles everything
- **Limitation:** One price per service (can't have dynamic pricing)

### Option B: Your Site Manages Payment (Recommended)
1. User selects service → sees price
2. Payment happens on your site via Stripe
3. On success → redirect to Cal.com for free booking
4. No payment collected in Cal.com

**Why?**
- Dynamic pricing possible
- Discount codes
- Add-on services
- Upsells

**Implementation:**
```typescript
// app/book/[service]/page.tsx
async function handlePayment(service) {
  // 1. Create Stripe payment intent
  const paymentIntent = await createPaymentIntent({
    amount: service.price * 100,
    currency: 'usd',
  });
  
  // 2. Confirm payment
  const { error } = await stripe.confirmCardPayment(
    paymentIntent.client_secret
  );
  
  // 3. If successful, redirect to Cal.com
  if (!error) {
    window.location.href = `${service.calLink}?payment=confirmed`;
  }
}
```

---

## 🔔 Notifications Setup

### Email Notifications (Automatic in Cal.com)
1. Go to Settings → Email Notifications
2. Enable:
   - ✅ "Someone books a meeting"
   - ✅ "Meeting cancelled"
3. Customize email templates

### SMS Reminders (Optional)

**Cal.com Free Plan:** Email only
**Cal.com Pro ($12/month):** SMS included

**Alternative - Twilio ($5-10/month):**
1. Sign up at https://twilio.com
2. Get API key
3. Use Cal.com webhooks to trigger SMS
4. Build custom reminder system

**Recommendation:** Start with email only, add SMS later if needed.

---

## 🚀 Quick Start Implementation

### Fastest Path (2-4 hours)

**Step 1:** Set up Cal.com (15 min)
```bash
1. Create account at cal.com
2. Connect Outlook calendar
3. Create 4-5 event types by duration
4. Add intake questions
```

**Step 2:** Set up Stripe (15 min)
```bash
1. Create account at stripe.com
2. Get API keys
3. Add to .env.local and Vercel
```

**Step 3:** Update booking page (1-2 hours)
```typescript
// app/book/page.tsx
import Link from 'next/link';

export default function BookPage() {
  return (
    <div>
      <h1>Book Your Treatment</h1>
      
      <div className="grid gap-6">
        <ServiceCard 
          service="Signature Aura Facial"
          calLink="your-username/60-minute-treatment"
          price="$125"
        />
        
        <ServiceCard 
          service="HydraFacial"
          calLink="your-username/60-minute-treatment"
          price="$180"
        />
        
        {/* More services */}
      </div>
      
      <p className="text-sm text-gray-600 mt-4">
        *Payment will be collected when you book your time slot
      </p>
    </div>
  );
}

function ServiceCard({ service, calLink, price }) {
  return (
    <div className="border rounded-lg p-6">
      <h3>{service}</h3>
      <p className="text-2xl font-bold">{price}</p>
      
      <Link 
        href={`https://cal.com/${calLink}`}
        className="bg-sage text-white px-6 py-2 rounded"
      >
        Book Now
      </Link>
    </div>
  );
}
```

**Step 4:** Test (30 min)
- Test booking flow
- Verify calendar sync
- Check emails
- Test payment

---

## 📝 API Integration (Optional)

### Automate Event Creation

Instead of manually creating events, use Cal.com API:

```typescript
// scripts/create-cal-events.ts
import { CalApi } from '@calcom/api';

async function createEvents() {
  const services = require('./app/_content/services.json');
  
  for (const service of services) {
    await calApi.createEvent({
      title: service.name,
      duration: service.duration,
      description: service.summary,
      slug: service.slug,
      price: service.price,
    });
  }
}

// Run: npx tsx scripts/create-cal-events.ts
```

**Time:** 1 hour to set up, saves hours later

---

## ✅ Implementation Checklist

### Cal.com Setup
- [ ] Create Cal.com account
- [ ] Connect Outlook calendar
- [ ] Connect Stripe account
- [ ] Create event types (4-5 or per-service)
- [ ] Add intake questions
- [ ] Test booking flow
- [ ] Configure email notifications

### Stripe Setup
- [ ] Create Stripe account
- [ ] Get API keys (publishable + secret)
- [ ] Add to .env.local
- [ ] Add to Vercel environment variables
- [ ] Test payment flow

### Integration
- [ ] Update /book page with Cal.com links
- [ ] (Optional) Add Cal.com embed widget
- [ ] (Optional) Add Stripe payment before redirect
- [ ] Test end-to-end flow
- [ ] Verify emails send correctly

### Production
- [ ] Switch Stripe to live mode
- [ ] Update Cal.com links to production
- [ ] Test with real booking
- [ ] Monitor for issues

---

## 🎯 Recommendation

**For Maximum Speed:**
1. Use **Option 1** (Simple Redirect) - 2 hours
2. Set up Cal.com with 4-5 duration-based events
3. Connect Stripe to Cal.com
4. Update /book page with Cal.com links
5. **Done!** Booking live

**Then Later (if needed):**
- Upgrade to Option 2 (Embedded) for better UX
- Add custom payment flow with your site
- Use Cal.com API for advanced features

---

## 💡 Tips

1. **Start simple** - Use Cal.com's built-in features first
2. **Test in staging** - Always test before going live
3. **Monitor payments** - Check Stripe dashboard regularly
4. **Email templates** - Customize Cal.com emails for your brand
5. **Mobile testing** - Most bookings happen on mobile

---

## 🆘 Troubleshooting

**Calendar not syncing:**
- Check Cal.com Settings → Connected Calendars
- Re-authenticate if needed

**Payment not processing:**
- Verify Stripe keys in environment variables
- Check Stripe dashboard for errors
- Test in Stripe test mode first

**Double bookings:**
- Cal.com prevents this automatically
- Make sure calendar is connected

**Emails not sending:**
- Check Cal.com email settings
- Verify SMTP settings if using custom email

---

## 📞 Need Help?

- Cal.com Docs: https://docs.cal.com
- Stripe Docs: https://docs.stripe.com
- Cal.com Support: support@cal.com
- Stripe Support: support@stripe.com

