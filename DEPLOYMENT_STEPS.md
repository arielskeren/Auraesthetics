# Deployment Guide: Aura Wellness Aesthetics to Vercel with GoDaddy

## Overview
This guide will walk you through deploying your Next.js site to Vercel and connecting your GoDaddy domain.

---

## Part 1: Deploy to Vercel

### Step 1: Push to GitHub (if not already done)

```bash
cd /Users/arielkeren/Documents/GitHub/Auraesthetics
git init  # Only if not already a git repo
git add .
git commit -m "Ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/Auraesthetics.git
git push -u origin main
```

**Note:** Replace `YOUR-USERNAME` with your actual GitHub username.

---

### Step 2: Create Vercel Account & Deploy

1. **Go to Vercel:** https://vercel.com
2. **Sign in** with GitHub
3. **Click "Add New..." → "Project"**
4. **Import your repository:** Select `Auraesthetics`
5. **Configure Project:**
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `.next` (auto-detected)
   - **Install Command:** `npm install` (auto-detected)
6. **Environment Variables:**
   - Click "Environment Variables"
   - Add:
     ```
     BREVO_API_KEY=INSERT API KEY
     BREVO_LIST_ID=INSERT LIST ID
     ```
7. **Click "Deploy"**

### Step 3: First Deploy
- Vercel will automatically build and deploy your site
- You'll get a URL like: `https://auraesthetics.vercel.app`
- This is your staging URL (keep it!)

---

## Part 2: Connect Your GoDaddy Domain

### Step 4: Get DNS Information from Vercel

1. In Vercel dashboard, go to your project
2. Click **Settings** → **Domains**
3. Click **Add Domain**
4. Enter your domain (e.g., `auraesthetics.com`)
5. Vercel will show you DNS records to add:
   - **A Record:** IP address for `@` (root domain)
   - **CNAME Record:** For `www` subdomain (usually points to cname.vercel-dns.com)

**Example of what Vercel will show:**
```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

---

## Part 5: Configure DNS in GoDaddy

### Step 5: Log into GoDaddy

1. Go to: https://www.godaddy.com
2. **Sign in** to your account
3. Go to **My Products** → **Domains**

### Step 6: Access DNS Settings

1. Find your domain (e.g., `auraesthetics.com`)
2. Click **DNS** (or three dots → DNS)
3. You'll see your current DNS records

### Step 7: Update DNS Records

**Important:** Don't delete all records at once. Add the new ones first!

1. **Add A Record for Root Domain (@):**
   - **Type:** A
   - **Name:** `@`
   - **Value:** The IP address Vercel provided (e.g., `76.76.21.21`)
   - **TTL:** 600 (or default)
   - Click **Add** or **Save**

2. **Update/Create CNAME for www:**
   - **Type:** CNAME
   - **Name:** `www`
   - **Value:** `cname.vercel-dns.com` (or what Vercel shows)
   - **TTL:** 600 (or default)
   - Click **Add** or **Save**

3. **Remove conflicting records:**
   - Look for any old A records pointing to different IPs
   - Remove any old CNAME records for www that point elsewhere
   - **Wait a few minutes between changes**

---

## Part 3: Complete Connection in Vercel

### Step 8: Verify Domain in Vercel

1. Go back to Vercel dashboard
2. Click **Settings** → **Domains**
3. Your domain should show as **"Valid Configuration"**
4. Click your domain → Click **"Verify"**

Vercel will automatically provision an SSL certificate (this takes 1-2 minutes).

---

## Part 4: Propagation & Testing

### Step 9: Wait for DNS Propagation

- DNS changes can take **5 minutes to 48 hours**
- Usually works within **15-30 minutes**
- Use this tool to check: https://www.whatsmydns.net
  - Enter your domain
  - Look for the A record to update

### Step 10: Test Your Site

1. Once DNS propagates, visit: `https://auraesthetics.com`
2. You should see your site!
3. Test the email capture form
4. Test mobile responsiveness

---

## Troubleshooting

### Issue: Domain not connecting

**Possible causes:**
- DNS not propagated yet (wait up to 24 hours)
- Wrong DNS records in GoDaddy
- DNS conflicts

**Solution:**
1. Double-check DNS records in GoDaddy match Vercel
2. Use https://www.whatsmydns.net to verify
3. Wait and check again

### Issue: SSL Certificate Error

**Solution:**
- Vercel provisions SSL automatically
- If you see an error, go to **Settings** → **Domains** → Click your domain → **"Redeploy"**

### Issue: Site shows "Vercel" page

**Solution:**
- Your DNS is correct, but domain isn't fully connected
- Go to Vercel → **Settings** → **Domains** → Click domain → **"Continue"**

### Issue: Build Errors

**Solution:**
- Check Vercel deployment logs
- Make sure environment variables are set
- Make sure all files are committed to GitHub

---

## Quick Checklist

**Before deploying:**
- [ ] Code is committed to GitHub
- [ ] `.env.local` has real Brevo credentials
- [ ] All files are saved
- [ ] No linting errors

**Vercel setup:**
- [ ] Account created
- [ ] Repository imported
- [ ] Environment variables added
- [ ] First deploy successful

**DNS in GoDaddy:**
- [ ] Found DNS settings
- [ ] Added A record for `@`
- [ ] Added CNAME for `www`
- [ ] Removed conflicting records

**Final steps:**
- [ ] Domain verified in Vercel
- [ ] SSL certificate active
- [ ] Site accessible at your domain
- [ ] Email capture form working

---

## Important Notes

1. **Keep your `.env.local` secure:** Never commit it to GitHub
2. **Vercel handles environment variables:** Add them in the dashboard
3. **DNS propagation:** Be patient, it can take time
4. **SSL is automatic:** Vercel provisions free SSL certificates
5. **Deployments:** Every push to GitHub auto-deploys to Vercel

---

## Your URLs After Deployment

- **Vercel URL:** `https://auraesthetics.vercel.app` (always works)
- **Your Domain:** `https://auraesthetics.com` (once DNS propagates)
- **www version:** `https://www.auraesthetics.com` (automatic)

All three URLs will work!

---

## Need Help?

- **Vercel Docs:** https://vercel.com/docs
- **GoDaddy DNS Help:** https://www.godaddy.com/help/manage-dns-records-680
- **Domain propagation checker:** https://www.whatsmydns.net

---

**Good luck! Your beautiful site is about to go live! 🌟**

