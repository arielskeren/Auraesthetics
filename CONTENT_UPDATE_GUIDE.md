# Content Update Guide

Quick reference for updating content without touching code.

## Updating Services

**File:** `/app/_content/services.json`

Each service has:
- `category` - "Facials", "Advanced", "Brows & Lashes", or "Waxing"
- `name` - Service name shown on the site
- `slug` - URL-friendly identifier (lowercase, hyphens)
- `summary` - Short description (1-2 sentences)
- `duration` - How long the service takes
- `price` - Price or "TBD"

**Example:**
```json
{
  "category": "Facials",
  "name": "Signature Aura Facial",
  "slug": "signature-aura-facial",
  "summary": "Customized facial for balanced, luminous skin.",
  "duration": "60–75 min",
  "price": "$120"
}
```

## Updating FAQs

**File:** `/app/_content/faqs.json`

Each FAQ has:
- `q` - Question
- `a` - Answer

**Example:**
```json
{
  "q": "How do I book an appointment?",
  "a": "Online booking is now available! Click the Book button in the navigation."
}
```

## Updating Site Information

**File:** `/app/_content/site.json`

Update:
- `name` - Business name
- `owner` - Owner name
- `tagline` - Hero tagline
- `socials.instagram` - Instagram handle
- `socials.tiktok` - TikTok handle
- `hours` - Business hours
- `location` - Studio address

## Updating Prices

When ready to add real prices:

1. Open `/app/_content/services.json`
2. Find each service
3. Replace `"price": "TBD"` with `"price": "$120"` (or actual price)
4. Save and commit changes

## Enabling Booking

When booking is ready:

1. **Update DisabledNotice component** or remove it
2. **Add booking link** in Nav.tsx
3. **Update /book page** with real booking embed
4. **Update FAQ** about booking process

## Adding Real Images

Currently using gradient placeholders. To add real images:

1. **Add images to** `/public/images/`
2. **Update components** to reference images:
   - Home page: Amy portrait, service images
   - About page: Amy portrait
   - Services page: Service photos

**Example:**
```tsx
<Image 
  src="/images/amy-portrait.jpg" 
  alt="Amy Margolis"
  width={500}
  height={600}
/>
```

## Changing Colors

**File:** `tailwind.config.ts`

Current palette:
- `sand`: #E9E2D8
- `ivory`: #F8F6F2
- `taupe`: #B6A999
- `sage`: #C9D2C0
- `charcoal`: #3F3A37
- `warm-gray`: #6B635B

To change a color:
1. Update hex value in `tailwind.config.ts`
2. Rebuild: `npm run build`

## Updating Contact Information

When ready to share contact info:

1. **Update** `/app/_content/site.json` with hours and location
2. **Update Footer component** (`/app/_components/Footer.tsx`) to show real contact details
3. **Update Contact page** to display real information

---

## After Making Changes

1. **Test locally:**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Update content"
   git push
   ```

3. **Auto-deploy:** Changes will automatically deploy to Vercel

