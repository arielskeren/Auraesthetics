# Cal.com Manual Settings Configuration

## Overview
Some Cal.com settings cannot be configured via API and must be set manually in the Cal.com dashboard. This guide covers the settings you need to configure.

## Settings to Configure

### 1. Disable Video Transcription

**Location:** Settings → Event Types → [Your Event] → Advanced

**Steps:**
1. Go to Cal.com dashboard
2. Navigate to **Settings** → **Event Types**
3. Select each event type
4. Go to **Advanced** tab
5. Find **"Video Transcription"** or **"Recordings"** section
6. Disable video transcription/recording
7. Save changes
8. Repeat for all event types

**Why:** You're not using video conferencing, so transcription is unnecessary.

---

### 2. Optimize Slots for Availability

**Location:** Settings → Availability → Slot Optimization

**Steps:**
1. Go to Cal.com dashboard
2. Navigate to **Settings** → **Availability**
3. Look for **"Slot Optimization"** or **"Smart Scheduling"**
4. Enable slot optimization features:
   - **Buffer Time Optimization**: Automatically add buffer time between bookings
   - **Slot Rounding**: Round time slots to nearest 5/10/15 minutes
   - **Availability Optimization**: Show most available times first
5. Configure buffer times (recommended: 10-15 minutes between appointments)
6. Save changes

**Why:** Improves scheduling efficiency and reduces booking conflicts.

---

### 3. Set Booking Window (120 Days)

**Location:** Settings → Event Types → [Your Event] → Availability

**Steps:**
1. Go to Cal.com dashboard
2. Navigate to **Settings** → **Event Types**
3. Select each event type
4. Go to **Availability** tab
5. Find **"Booking Window"** or **"Advanced Scheduling"**
6. Set **"Maximum advance booking"** to **120 days**
7. Save changes
8. Repeat for all event types

**Alternative:** If the API script (`npm run configure-cal-settings`) successfully set this, verify it worked. If not, set it manually.

**Why:** Prevents bookings too far in advance.

---

### 4. Hide Events from Public Page

**Location:** Settings → Event Types → [Your Event] → Visibility

**Steps:**
1. Go to Cal.com dashboard
2. Navigate to **Settings** → **Event Types**
3. Select each event type
4. Go to **Visibility** or **Settings** tab
5. Find **"Hide from public page"** or **"Visibility"**
6. Enable **"Hidden"** or **"Private"**
7. Save changes
8. Repeat for all event types

**Why:** Events should only be accessible via your custom payment flow (not directly from Cal.com).

**Note:** This is already configured if events are set to hidden by default.

---

### 5. Set Minimum Booking Notice (2 Hours)

**Location:** Settings → Event Types → [Your Event] → Availability

**Steps:**
1. Go to Cal.com dashboard
2. Navigate to **Settings** → **Event Types**
3. Select each event type
4. Go to **Availability** tab
5. Find **"Minimum Booking Notice"** or **"Advance Notice"**
6. Set to **120 minutes** (2 hours)
7. Save changes
8. Repeat for all event types

**Note:** This should be set via the API script, but verify it worked.

**Why:** Prevents last-minute bookings that may not be feasible.

---

## Quick Checklist

- [ ] Disable video transcription for all events
- [ ] Enable slot optimization in Availability settings
- [ ] Set booking window to 120 days for all events
- [ ] Verify events are hidden from public page
- [ ] Verify minimum booking notice is 2 hours (120 minutes)
- [ ] Test a booking flow to ensure all settings are working

## Verification

After configuring settings:

1. **Test Booking Flow:**
   - Complete a payment with test card
   - Book an appointment
   - Verify booking appears correctly in Cal.com

2. **Check Event Settings:**
   - Verify video transcription is disabled
   - Verify booking window is 120 days
   - Verify minimum notice is 2 hours

3. **Check Slot Optimization:**
   - Create a test booking
   - Verify buffer times are respected
   - Verify slots are optimized

## Troubleshooting

**Settings not saving:**
- Check your Cal.com plan permissions
- Some settings may require paid plans
- Try refreshing and re-saving

**Settings not applying:**
- Clear browser cache
- Log out and log back in
- Check Cal.com status page for issues

**API vs Manual:**
- Some settings can be set via API (see `npm run configure-cal-settings`)
- Others must be set manually (video transcription, slot optimization)
- Always verify settings after API updates

## Resources

- [Cal.com Settings Documentation](https://cal.com/docs/enterprise-features/settings)
- [Cal.com API Documentation](https://developer.cal.com/api)
- Your Cal.com dashboard: Settings → Event Types

