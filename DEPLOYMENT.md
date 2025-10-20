# Deployment Guide - Aura Aesthetics

## Quick Deploy to Vercel (Recommended)

### Method 1: Using Vercel Dashboard (Easiest)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Aura Aesthetics website"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Click "Deploy" (all settings are auto-configured for Next.js)

3. **Done!** Your site will be live at `your-project-name.vercel.app`

### Method 2: Using Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Follow the prompts** and your site will be live.

---

## Pre-Deployment Checklist

- [x] Build completes without errors (`npm run build`)
- [ ] Update content in `/app/_content/` JSON files with real data
- [ ] Replace gradient placeholders with real images (optional)
- [ ] Add real favicon in `/public/favicon.ico`
- [ ] Update `robots.txt` with actual domain
- [ ] Add real social media links in Footer
- [ ] Configure custom domain in Vercel (if applicable)
- [ ] Test email capture form (currently UI-only)
- [ ] Update metadata/SEO descriptions in page files

---

## Custom Domain Setup

After deploying to Vercel:

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain (e.g., `auraesthetics.com`)
4. Update DNS records as instructed by Vercel
5. Wait for DNS propagation (usually 24-48 hours)

---

## Environment Variables (Future)

When adding email capture backend or booking integration:

1. Add environment variables in Vercel dashboard under "Settings" → "Environment Variables"
2. Common variables needed later:
   - `MAILCHIMP_API_KEY`
   - `BOOKING_PLATFORM_API_KEY`
   - `DATABASE_URL` (if using Supabase/etc.)

---

## Post-Launch Updates

To update content after launch:

1. **Edit JSON files:**
   - Services: `/app/_content/services.json`
   - FAQs: `/app/_content/faqs.json`
   - Site info: `/app/_content/site.json`

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Update services/content"
   git push
   ```

3. **Automatic deployment:** Vercel will automatically rebuild and deploy

---

## Performance Monitoring

After deployment, monitor:
- **Vercel Analytics:** Built-in, enable in project settings
- **Google Analytics:** Add tracking code to `layout.tsx` if needed
- **Speed:** Test with Lighthouse in Chrome DevTools

---

## Troubleshooting

**Build fails on Vercel:**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Run `npm run build` locally to test

**Images not showing:**
- Check file paths are correct
- Ensure images are in `/public` directory

**Styles not loading:**
- Verify Tailwind config is correct
- Check `globals.css` is imported in `layout.tsx`

---

## Support

For deployment issues, see:
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

