# Brevo Tracking Guide for Welcome Offer Signups

## Overview
Track which users signed up via the welcome offer vs other methods (footer, floating bubble, etc.)

## Recommended Approach: Single List with Custom Attribute

**Why Single List?**
- Simpler to manage
- Easier to email everyone at once
- Can segment by attribute
- No duplicate data

**How to Track:**
- Add a custom attribute `SIGNUP_SOURCE` to your Brevo contact
- Set the value based on where they signed up

---

## Implementation

### 1. Create Custom Attribute in Brevo

1. Go to **Brevo Dashboard** → **Contacts** → **Settings** → **Contact Attributes**
2. Click **"Add Attribute"**
3. Details:
   - **Name:** `SIGNUP_SOURCE`
   - **Type:** Text (or category)
   - **Required:** No
4. Click **Save**

### 2. Update API Route

Add to `app/api/subscribe/route.ts`:

```typescript
// Get source from request body or default
const signupSource = body.signupSource || 'footer';

// Add to Brevo attributes
attributes.SIGNUP_SOURCE = signupSource;
```

### 3. Update Form Components

Pass `signupSource` in the submit:

```typescript
// In EmailCapture.tsx
const response = await fetch('/api/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    firstName,
    lastName,
    email, 
    phone,
    signupSource: 'welcome-offer' // or 'footer', 'floating-bubble'
  }),
});
```

### 4. Values to Use

- `welcome-offer` - Initial popup modal (15% discount)
- `footer` - Footer email capture (regular)
- `floating-bubble` - Dismissed modal, used floating bubble
- `book-page` - Email capture on /book page

---

## Segmentation in Brevo

Once you have the attribute, you can:

1. **Create Segments:**
   - Brevo Dashboard → Contacts → Segments
   - Filter by: `SIGNUP_SOURCE = "welcome-offer"`
   - Name: "Welcome Offer Signups"

2. **Send Targeted Emails:**
   - Email only welcome offer signups with discount code
   - Email others with general updates

3. **Track Conversion:**
   - See who actually used the 15% discount
   - Compare welcome offer signups vs regular signups

---

## Alternative: Separate Lists

**If you prefer separate lists:**

1. Create new list in Brevo: "Welcome Offer Signups" (List ID: X)
2. Update API route to use different list based on source
3. Update `BREVO_LIST_ID` in `.env.local` for welcome offers

**Pros:** Clear separation
**Cons:** More to manage, harder to send to everyone

---

## My Recommendation: Single List + Attribute

**Best for you because:**
- ✅ You already have main list set up
- ✅ Can track all signups in one place
- ✅ Easy to segment later
- ✅ Simple to implement (just add one field)

**Implementation time:** 5 minutes to add the attribute to Brevo + update API route

