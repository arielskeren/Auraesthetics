# Aura Wellness Aesthetics

A modern, elegant website for Aura Wellness Aesthetics - a serene skincare studio by Amy in Fort Lauderdale, FL.

## 🌟 Features

- **Service Catalog**: 20+ aesthetic treatments with detailed descriptions
- **Responsive Design**: Beautiful on all devices (mobile, tablet, desktop)
- **Email Capture**: Integrated Brevo mailing list signup
- **Fast & Modern**: Built with Next.js 14, TypeScript, Tailwind CSS
- **SEO Optimized**: Metadata and Open Graph tags included

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Email Service**: Brevo (formerly Sendinblue)
- **Hosting**: Vercel

## 📦 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/Auraesthetics.git
cd Auraesthetics

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Add your credentials to .env.local
# BREVO_API_KEY=your_api_key
# BREVO_LIST_ID=your_list_id
```

### Development

```bash
# Start dev server
npm run dev

# Visit http://localhost:4000
```

### Build

```bash
# Create production build
npm run build

# Start production server
npm start
```

## 📝 Content Management

Edit content in JSON files:
- **Services**: `app/_content/services.json`
- **FAQs**: `app/_content/faqs.json`
- **Site Info**: `app/_content/site.json`

## 🌐 Deployment

The site is hosted on Vercel and automatically deploys on every push to `main`.

**Live URLs:**
- Production: https://theauraesthetics.com
- Vercel: https://auraesthetics.vercel.app

## 📧 Email Integration

The site integrates with Brevo for email capture:
- Environment variables are set in Vercel dashboard
- Contacts are added to a Brevo mailing list
- Form appears in footer on all pages

## 🎨 Design

- **Colors**: Sand, Ivory, Taupe, Sage, Charcoal
- **Fonts**: Cormorant Garamond (serif), Inter (sans-serif)
- **Style**: Bohemian, serene, minimalist

## 📄 License

All rights reserved © Aura Wellness Aesthetics
