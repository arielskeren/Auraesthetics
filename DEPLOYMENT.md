# Deployment & Setup Guide

## Quick Reference

### Live Site
- **URL:** https://theauraesthetics.com
- **Hosting:** Vercel
- **Environment:** Production

### Environment Variables (Vercel)
Required in Vercel dashboard → Settings → Environment Variables:
```
BREVO_API_KEY=your_api_key_from_brevo
BREVO_LIST_ID=your_list_id_from_brevo
```

### DNS (GoDaddy)
- **A Record:** `@` → Vercel IP (from Vercel dashboard)
- **A Record:** `www` → Vercel IP

### Common Issues

**Email form not working:**
- Check environment variables are set in Vercel
- Verify API key is valid in Brevo
- Check Vercel function logs for errors

**Domain not connecting:**
- Verify DNS records in GoDaddy
- Wait 15-30 minutes for DNS propagation
- Check with https://www.whatsmydns.net

**Need to redeploy:**
- Push changes to GitHub
- Vercel auto-deploys
- Or: Vercel dashboard → Deployments → Redeploy

## Local Development

```bash
npm run dev          # http://localhost:4000
npm run build        # Build for production
```

## Updating Content

Edit these files and push to GitHub:
- `app/_content/services.json` - Services
- `app/_content/faqs.json` - FAQs
- `app/_content/site.json` - Site info
