<!-- c2816d78-ca5d-4a4f-b588-4c4ba01b120d 1193297f-0638-4e51-9e5b-ebda7a1decff -->
# Cal.com + Stripe Booking Integration Plan

## Overview

Implement Option 3 (Full Custom Integration) with Cal.com managing payments directly, API-based event creation from services.json, and email-only notifications.

## Implementation Steps

### Phase 1: Environment & Dependencies Setup

**Install required packages:**

```bash
npm install stripe @stripe/stripe-js
npm install dotenv
```

**Add environment variables to `.env.local`:**

```env
# Cal.com API
CAL_COM_API_KEY=cal_live_...
CAL_COM_USERNAME=your-username

# Stripe (from Cal.com integration)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

**Add same variables to Vercel dashboard** for production deployment.

### Phase 2: Cal.com API Event Creation Script

**Create `scripts/create-cal-events.ts`:**

- Read all services from `app/_content/services.json` (21 services)
- Parse duration string (e.g., "60-75 min" → 75 minutes)
- Extract price from placeholder "from $--" (set to 0 for now, will be updated manually in Cal.com)
- For each service, call Cal.com API to create event type:
  - `POST https://api.cal.com/v1/event-types`
  - Set title, slug, duration, description
  - Configure calendar integration (Outlook)
  - Add intake form fields: name, email, phone, skin concerns, allergies, previous treatments
  - Set availability (inherit from default)
- Log created event IDs and URLs
- Save mapping to `cal-events-mapping.json` for reference

**Handle edge cases:**

- Skip if event already exists (check by slug)
- Retry on API failures
- Validate all fields before submission

### Phase 3: Update Services Data Structure

**Modify `app/_content/services.json`:**

- Add `calEventId` field to each service (populated after script runs)
- Add `calLink` field (e.g., "your-username/signature-aura-facial")
- Keep existing fields: category, name, slug, summary, description, duration, price

### Phase 4: Rebuild Booking Page

**Replace `app/book/BookClient.tsx` completely:**

**New structure:**

1. Import services from JSON
2. Filter and group by category
3. Display service cards with:

   - Service name, summary, duration
   - "Book Now" button → redirects to Cal.com event page
   - Use actual Cal.com link: `https://cal.com/{username}/{service.slug}`

4. Add search/filter functionality
5. Mobile-responsive grid layout
6. Use existing design system (Section, motion, Tailwind colors)

**Service card component:**

- Show gradient placeholder image (like current ServiceCard)
- Display pricing placeholder
- Click → `window.location.href = service.calLink`
- No modal, direct redirect to Cal.com

### Phase 5: Update Service Modal (Remove Payment, Add Cal.com Link)

**Modify `app/_components/ServiceModal.tsx`:**

- Remove calendar placeholder
- Keep service details, description, before/after images
- Replace "Book Now" button with Cal.com redirect
- Add "View Full Details & Book" button at bottom
- Ensure mobile-responsive

### Phase 6: Cal.com & Stripe Manual Setup

**Cal.com setup (manual steps for user):**

1. Create Cal.com account at https://cal.com
2. Connect Outlook calendar (Settings → Calendars → Microsoft 365)
3. Install Stripe app (Settings → Apps → Stripe)
4. Authenticate Stripe account
5. Get API key (Settings → Developer → API Keys)
6. Configure default availability hours
7. Set up email notification templates

**After running the script:**

- Manually set pricing for each event in Cal.com dashboard
- Test one booking end-to-end
- Verify Outlook sync works
- Check email notifications send correctly

### Phase 7: API Route for Booking Confirmation (Optional)

**Create `app/api/booking-webhook/route.ts`:**

- Receive webhook from Cal.com when booking is created
- Verify webhook signature
- Log booking details
- (Optional) Send to Brevo for tracking
- (Optional) Trigger custom email

This enables additional tracking and custom logic post-booking.

### Phase 8: Update Navigation & Home Page

**Update home page service cards:**

- Change click handler to open ServiceModal
- Modal now has "Book Now" → Cal.com redirect

**Update `/book` page metadata:**

- Change "Opens Soon" to "Book Your Treatment"
- Update description for SEO

**Update navigation:**

- Keep "Book Online — Coming Soon" button
- After launch, change to "Book Now"

### Phase 9: Testing & Deployment

**Local testing:**

1. Run script to create events (in Cal.com test mode)
2. Test booking flow for each service category
3. Verify Outlook calendar events are created
4. Check email confirmations arrive
5. Test payment processing (Stripe test mode)

**Production deployment:**

1. Switch Cal.com to live mode
2. Switch Stripe to live mode
3. Update environment variables in Vercel
4. Deploy to production
5. Test with real booking
6. Monitor Stripe dashboard and Cal.com logs

### Phase 10: Documentation & Cleanup

**Update `CAL_COM_IMPLEMENTATION.md`:**

- Document actual implementation choices
- Add troubleshooting for common issues
- List all Cal.com event URLs

**Update `README.md`:**

- Add Cal.com to tech stack
- Document booking system architecture
- Add instructions for updating services

**Delete temporary files:**

- Remove `CAL_COM_IMPLEMENTATION.md` after implementation is complete

## Key Files to Create/Modify

**New files:**

- `scripts/create-cal-events.ts` - API script to create events
- `scripts/cal-events-mapping.json` - Generated mapping of services to Cal.com event IDs
- `app/api/booking-webhook/route.ts` - Webhook handler (optional)

**Modified files:**

- `app/_content/services.json` - Add calEventId and calLink fields
- `app/book/BookClient.tsx` - Complete rebuild with service listing
- `app/_components/ServiceModal.tsx` - Update to redirect to Cal.com
- `package.json` - Add Stripe dependencies
- `.env.local` - Add Cal.com and Stripe keys
- `README.md` - Document new booking system

## Technical Decisions

**Why Cal.com manages payments:**

- Simpler integration (no custom Stripe logic needed)
- Cal.com handles payment → booking atomically
- Less code to maintain
- Built-in refund/cancellation handling

**Why API script for event creation:**

- Saves hours of manual work (21 services)
- Ensures consistency across all events
- Easy to re-run if changes needed
- Generates documentation automatically

**Why full custom integration (Option 3):**

- Complete control over booking flow
- Can add features later (packages, add-ons)
- Better integration with existing site design
- Flexible for future enhancements

## Estimated Timeline

- Phase 1-2: 2 hours (setup + script)
- Phase 3-5: 3 hours (update UI)
- Phase 6: 1 hour (manual Cal.com setup)
- Phase 7-8: 2 hours (webhook + navigation)
- Phase 9: 1 hour (testing)
- Phase 10: 30 min (docs)

**Total: ~10 hours**

### To-dos

- [ ] Install Stripe packages and set up environment variables
- [ ] Build Cal.com API script to auto-create all 21 service events from services.json
- [ ] Add calEventId and calLink fields to services.json structure
- [ ] Replace BookClient.tsx with new service listing and Cal.com redirect logic
- [ ] Modify ServiceModal to remove calendar placeholder and add Cal.com redirect button
- [ ] Guide user through Cal.com account setup, Outlook sync, Stripe connection, and API key retrieval
- [ ] Execute script to create all Cal.com events and save mapping
- [ ] Create optional booking webhook API route for post-booking tracking
- [ ] Update home page and navigation to reflect live booking system
- [ ] Test full booking flow, verify integrations, and deploy to production