# Aura Aesthetics Website

A beautiful, bohemian wellness website for Amy Margolis's aesthetics studio.

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

   The site will automatically reload when you make changes to files.

### Available Scripts

- `npm run dev` - Start development server (with hot reload)
- `npm run build` - Build for production
- `npm run start` - Run production build locally
- `npm run lint` - Check code for issues

## Testing Before Deployment

1. Run `npm run build` to create a production build
2. Run `npm run start` to test the production build locally
3. Visit all pages and test:
   - Navigation between pages
   - Disabled booking states
   - Email capture form validation
   - Responsive design (resize browser or use dev tools)
   - Accessibility (tab through all interactive elements)

## Project Structure

```
/app
  /_components      # Reusable UI components
  /_content         # JSON data files (services, FAQs, site info)
  /about            # About page
  /book             # Booking page (disabled state)
  /contact          # Contact page (disabled state)
  /faq              # FAQ page
  /services         # Services page
  page.tsx          # Home page
  layout.tsx        # Root layout with Nav and Footer
  globals.css       # Global styles and design tokens
```

## Design System

### Colors
- **Sand:** `#E9E2D8` - Warm background
- **Ivory:** `#F8F6F2` - Primary background
- **Taupe:** `#B6A999` - Accents
- **Sage:** `#C9D2C0` - Highlights
- **Charcoal:** `#3F3A37` - Primary text
- **Warm Gray:** `#6B635B` - Secondary text

### Typography
- **Headings:** Cormorant Garamond (serif)
- **Body:** Inter (sans-serif)

## Content Updates

To update content without changing code:

1. **Services:** Edit `/app/_content/services.json`
2. **FAQs:** Edit `/app/_content/faqs.json`
3. **Site Info:** Edit `/app/_content/site.json`

## Deployment

This site is ready to deploy to Vercel:

1. Push to GitHub
2. Import repository in Vercel
3. Deploy (automatic configuration for Next.js)

## Notes

- Email capture is UI-only; backend integration needed later
- Booking functionality is disabled with placeholder states
- All TBD content can be updated in JSON files or component text
- Image placeholders use gradients; replace with real images when ready

## Support

For questions or issues, contact the development team.

