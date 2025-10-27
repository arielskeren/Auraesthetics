# Fix: Environment Variables Missing in Vercel

## Problem
Your live site at theauraesthetics.com is getting 500/401 errors because Vercel doesn't have your Brevo API credentials.

## Solution: Add Environment Variables to Vercel

### Step 1: Go to Vercel Dashboard

1. Visit: https://vercel.com
2. Sign in
3. Click on your **Auraesthetics** project

### Step 2: Add Environment Variables

1. Click **Settings** → **Environment Variables**
2. Click **Add New**
3. Add these two variables:

**Variable 1:**
- **Key:** `BREVO_API_KEY`
- **Value:** `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`
- **Environment:** Select all (Production, Preview, Development)
- Click **Save**

**Variable 2:**
- **Key:** `BREVO_LIST_ID`
- **Value:** `3`
- **Environment:** Select all (Production, Preview, Development)
- Click **Save**

### Step 3: Redeploy

After adding the environment variables:

1. Go to **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**
4. Or simply: Click **Settings** → **Environment Variables** → Click **"Redeploy"** button

### Step 4: Wait for Deployment

- Vercel will rebuild your site with the new environment variables
- Takes 1-2 minutes
- You'll see "Ready" status when done

### Step 5: Test

Visit: https://theauraesthetics.com
- Try the email form in the footer
- Should work now!

---

## Why This Happened

- `.env.local` is only for local development
- Vercel needs environment variables added through their dashboard
- Production and local environments are separate

---

## Verify It's Working

1. Fill out the form on the live site
2. Should show success message
3. Check Brevo dashboard for the new contact

---

**That's it! Your email form should work after adding these variables and redeploying.**

