# Aura Wellness Aesthetics

A modern, elegant website for Aura Wellness Aesthetics — a serene skincare studio by Amy in Fort Lauderdale, FL.

## ✅ Current Status

**Design:** Complete with green color scheme and dark sage accents  
**Services:** 17 services configured with correct pricing  
**Booking:** Infrastructure ready, waiting for Cal.com access  
**Email:** Brevo integration active  
**Dev Server:** Running at http://localhost:5555

## 🌟 Features

- ✅ 17 services with detailed treatment information
- ✅ Responsive design with bohemian aesthetic + green accents
- ✅ Email capture with Brevo integration
- ⏳ Booking system (Cal.com + Stripe ready, waiting on account access)
- ✅ Fast, modern Next.js architecture

## 🛠 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Email:** Brevo
- **Hosting:** Vercel

## 📦 Quick Start

### Installation
```bash
npm install
npm run dev
```

### Environment Variables
Create `.env.local`:
```env
# Brevo Email Integration
BREVO_API_KEY=your_brevo_api_key
BREVO_LIST_ID=your_list_id

# Cal.com Booking (for when access is restored)
CAL_COM_API_KEY=your_api_key
CAL_COM_USERNAME=theauraesthetics
```

### Development
```bash
npm run dev                    # Start dev server at http://localhost:5555
npm run build                  # Build for production
npm start                      # Start production server

# Cal.com Integration (when access is restored)
npm run create-cal-events      # Create events in Cal.com via API
npm run update-cal-events      # Update pricing/duration in Cal.com
```

## 📝 Content Management

Edit content in JSON files:
- `app/_content/services.json` - Services catalog
- `app/_content/faqs.json` - FAQ content
- `app/_content/site.json` - Site metadata

## 🌐 Deployment

The site is deployed to Vercel and automatically updates on push to `main` branch.

**Live URLs:**
- Production: https://theauraesthetics.com
- Vercel: https://auraesthetics.vercel.app

### Environment Variables in Vercel
1. Go to: https://vercel.com/dashboard
2. Project → Settings → Environment Variables
3. Add:
   - `BREVO_API_KEY` (from Brevo dashboard)
   - `BREVO_LIST_ID` (from Brevo lists)

### DNS Configuration (GoDaddy)
- A Record: `@` → Vercel IP (from Vercel dashboard)
- A Record: `www` → Vercel IP

## 📧 Email Integration

- **Provider:** Brevo
- **Contact Form:** Footer signup on all pages
- **API Route:** `/api/subscribe`

## 📅 Booking Integration (In Progress)

- **Provider:** Cal.com
- **Payment:** Stripe
- **Status:** Waiting for Cal.com to restore account access
- **Next Steps:** See `CAL_COM_SETUP_WHEN_READY.md`

## 💻 Project Structure

```
app/
  _components/      # Reusable components
  _content/         # JSON data files
  api/              # API routes
  about/            # About page
  services/         # Services listing
  book/             # Booking page
  faq/              # FAQ page
  contact/          # Contact page
  forms/            # Client forms
```

## 🎨 Design

- **Colors:** Sand, Ivory, Taupe, Sage, Charcoal
- **Fonts:** Cormorant Garamond (serif), Inter (sans-serif)
- **Style:** Bohemian, serene, minimalist

## 📄 License

© Aura Wellness Aesthetics - All rights reserved
