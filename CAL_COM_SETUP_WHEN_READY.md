# Cal.com Setup - When Access is Restored

## Current Status
- ✅ Website is complete with green color scheme
- ✅ All 17 services updated with correct pricing from your CSVs
- ✅ Booking pages built and ready
- ⏳ Waiting for Cal.com to restore account access
- ⏳ Need to create 17 events in Cal.com (preferably manually)
- ⏳ Need to get booking URLs and update services.json

## What Happened
Your Cal.com accounts got blocked due to too many API calls during automated event creation. This is Cal.com's anti-fraud protection. We sent them a support email explaining the situation.

## What to Do When Access is Restored

### Option 1: Manual Event Creation (Recommended - Safer)

1. **Log into Cal.com** at https://cal.com

2. **Create your first event as a template:**
   - Go to Event Types → Add Event Type
   - Use "HydraFacial" as your first one (already has pricing set in our system: $135, 60 min)
   - Fill in all details including booking form fields
   - Click Save

3. **Use Duplicate Feature:**
   - Find your event in the list
   - Click "Duplicate" or use the 3-dot menu → "Copy"
   - Update title, slug, description, price, duration
   - Repeat for all 17 services

4. **Your 17 Services with Pricing:**

**Facials:**
- The Aura Facial - $150 - 75 min
- Anti-aging Facial - $165 - 60 min
- HydraFacial - $135 - 60 min
- Glass Skin Facial - $155 - 75 min
- Signature Detox Facial - $135 - 75 min
- Lymphatic Drainage Facial - $145 - 90 min

**Advanced:**
- Dermaplaning - $60 - 30 min
- Biorepeel - $230 - 45 min
- Microneedling - $170 - 60 min
- Oxygen Peel - $130 - 60 min
- LED Light Therapy - $25 - 15 min

**Brows & Lashes:**
- Brow Lamination - $80 - 60 min
- Brow Tint - $20 - 10 min
- Brow Wax & Tint - $35 - 30 min
- Lash Lift & Tint - $80 - 60 min
- Brow Lamination & Lash Lift Combo - $160 - 85 min

**Waxing:**
- Brow Wax - $20 - 20 min
- Lip Wax - $10 - 5 min

### Option 2: Use API Scripts (If They Provide Guidance)

If Cal.com provides specific rate limits or best practices:
1. Update `.env.local` with fresh API key
2. Use `npm run create-cal-events` (with their guidance on limits)
3. The script will automatically create all events

## After Events Are Created

1. **Get all booking URLs** from Cal.com (format: `https://cal.com/theauraesthetics/[slug]`)

2. **Update services.json:**
   - Open `app/_content/services.json`
   - For each service, update:
     - `calEventId`: The event ID from Cal.com
     - `calBookingUrl`: The full booking URL

3. **Test a booking** to make sure everything works

4. **Connect Stripe** when ready to accept payments

## Current Files

- `app/_content/services.json` - Contains all services with pricing
- `scripts/create-cal-events.ts` - Creates events via API (use carefully)
- `scripts/update-cal-events.ts` - Updates pricing/duration via API
- `package.json` - Has npm scripts for both operations

## Need Help?

Once Cal.com responds, share their guidance with me and I'll help you complete the setup using their recommended approach.

