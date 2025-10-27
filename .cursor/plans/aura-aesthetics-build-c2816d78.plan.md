<!-- c2816d78-ca5d-4a4f-b588-4c4ba01b120d c495e7d2-fc3d-461c-b334-86805a500a1b -->
# Aura Aesthetics Website Implementation

## 1. Project Initialization & Configuration

Initialize Next.js 14+ project with TypeScript and configure Tailwind CSS with custom design tokens (Sand, Ivory, Taupe, Sage, Charcoal, Warm Gray palette). Install Framer Motion for micro-animations. Set up Google Fonts (Cormorant Garamond for headings, Inter for body).

**Key files:**

- `tailwind.config.ts` - custom colors, typography scale
- `app/globals.css` - CSS variables, base styles
- `next.config.js` - optimize images, fonts

## 2. Content Data Structure

Create JSON files in `app/_content/` for services, FAQs, and site metadata. Structure services with categories (Facials, Advanced, Brows & Lashes, Waxing), each with name, slug, summary, duration, and price placeholders.

**Files:**

- `app/_content/site.json` - brand name, tagline, socials (TBD)
- `app/_content/services.json` - 13 services across 4 categories
- `app/_content/faqs.json` - 10 pre-written Q&A pairs

## 3. Core Components

Build reusable components with accessibility baked in:

**`app/_components/Button.tsx`** - Primary (Charcoal bg, Sage hover) and Secondary (outline) variants, plus Disabled state with tooltip

**`app/_components/ServiceCard.tsx`** - Image placeholder (gradient blocks), name, summary, duration/price, hover lift effect

**`app/_components/Accordion.tsx`** - FAQ accordion with `aria-expanded`, keyboard navigation, arrow rotation

**`app/_components/EmailCapture.tsx`** - Form with email, optional SMS, consent checkbox; validation UI only (no backend)

**`app/_components/DisabledNotice.tsx`** - Muted button with "Opens soon" tooltip, optional modal trigger

**`app/_components/Nav.tsx`** - Sticky nav with Home, About, Services, Book (disabled), FAQ links

**`app/_components/Footer.tsx`** - Contact placeholders, hours TBD, social links, email capture, Terms/Privacy links

**`app/_components/Section.tsx`** - Wrapper with consistent spacing and optional background colors

## 4. Page Implementation

**`app/page.tsx` (Home)**

- Hero section: H1 "Skin rituals, done gently", disabled "Book Online" button, "Join the List" secondary button
- 3 value pillars (Calm First, Skin-Health Focused, Thoughtful Craft) in grid
- Featured services: 3 cards (Signature Aura Facial, Dermaplaning Glow, Brow Shape + Tint)
- Amy intro teaser with portrait placeholder
- Email capture block
- Subtle parallax on hero background (<10% movement)

**`app/about/page.tsx`**

- Portrait placeholder (warm gradient) + bio text
- Credentials section (placeholder for licenses)
- 3 approach blocks (Gentle by design, Customization, Education)
- Split layout: image left, content right on desktop; stacked mobile

**`app/services/page.tsx`**

- Category filter tabs (All, Facials, Advanced, Brows & Lashes, Waxing)
- Service cards grid (3 columns desktop → 1 column mobile)
- Each card links to disabled booking or shows "Coming soon"
- Pre/post-care notes section at bottom
- Contraindications callout

**`app/book/page.tsx`**

- Large disabled notice: "Online booking opens soon"
- Email/SMS capture form
- Copy: "We're finalizing our calendar. Join the list for launch perks"
- Centered layout with warm background

**`app/faq/page.tsx`**

- Single-column accordion list
- 10 pre-populated questions from `faqs.json`
- Large tap targets (min 44px)
- Smooth expand/collapse with height animation

**`app/contact/page.tsx` (disabled)**

- Placeholder contact card
- Map placeholder (gradient block)
- "Temporarily unavailable" notice
- Email capture form

## 5. Design & Styling

Implement bohemian aesthetic:

- Warm texture gradients for hero/backgrounds (Sand → Ivory, Taupe accents)
- Typography scale: H1 40-48px, H2 28-32px, H3 22-24px, body 16px, line-height 1.5+
- Card hover: subtle lift (translateY -4px) + shadow
- Link hover: underline slide-in animation
- Focus rings: 2px Sage outline with offset
- Spacing: generous whitespace (section padding 80-120px desktop, 48-64px mobile)
- Rounded corners: 8px for cards, 4px for buttons

## 6. Accessibility & Responsiveness

- Test color contrast (Charcoal on Sand/Ivory) meets WCAG AA
- All images have descriptive alt text
- Keyboard navigation with visible focus states
- ARIA labels on accordions, disabled buttons
- Mobile-first responsive: breakpoints at 640px, 768px, 1024px, 1280px
- Touch targets minimum 44x44px
- Skip-to-content link

## 7. SEO & Metadata

- Page titles: "aura aesthetics — Amy Margolis | [Page Name]"
- Meta description: "Bohemian, serene skincare studio by Amy Margolis..."
- Open Graph image (warm gradient with wordmark)
- Favicon: simple "a" monogram
- Semantic HTML5 structure
- Generate `robots.txt` and `sitemap.xml`

## 8. Local Development & Testing

Configure npm scripts in `package.json` for easy local testing:

- `npm run dev` - Start development server at http://localhost:3000
- `npm run build` - Build production version
- `npm run start` - Run production build locally
- `npm run lint` - Check for code issues

Add a `README.md` with quick-start instructions for Amy/reviewers to test the site locally.

## 9. Polish & Performance

- Lazy load images with `next/image`
- Optimize Google Fonts loading (swap display)
- Minimal hydration: only interactive sections
- Framer Motion: fade/slide animations <250ms, ease-out easing
- Test on mobile devices (iOS/Android)
- Verify all disabled states show appropriate messaging
- Run local server to verify all pages, links, and disabled states work correctly

### To-dos

- [ ] Initialize Next.js project with TypeScript, Tailwind CSS, and Framer Motion
- [ ] Configure design tokens, CSS variables, and typography in globals.css and tailwind.config.ts
- [ ] Create JSON content files for site metadata, services, and FAQs
- [ ] Build reusable components: Button, ServiceCard, Accordion, EmailCapture, DisabledNotice, Section
- [ ] Implement Nav and Footer components with disabled states
- [ ] Build Home page with hero, pillars, featured services, and email capture
- [ ] Build About page with bio, credentials, and approach sections
- [ ] Build Services page with category filtering and service cards grid
- [ ] Build Book, FAQ, and Contact pages with appropriate disabled states
- [ ] Add micro-animations, hover states, responsive design, and accessibility features
- [ ] Add SEO metadata, Open Graph tags, and favicon to all pages