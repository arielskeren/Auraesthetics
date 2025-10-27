# Brevo Email Integration Setup Guide

## Overview
Your Aura Wellness Aesthetics website now has Brevo (formerly Sendinblue) email integration configured. Follow these steps to complete the setup.

---

## Step 1: Create Brevo Account

1. Go to: https://www.brevo.com
2. Click **"Sign up free"**
3. Fill in your details
4. Verify your email address

---

## Step 2: Get Your API Key

1. Log into your Brevo account: https://app.brevo.com
2. Navigate to: **Settings** → **SMTP & API** → **API Keys**
   OR
   Direct link: https://app.brevo.com/settings/keys/api
3. Click **"Generate a new API key"**
4. Name it: `Aura Wellness Website`
5. Select **"Mailer"** permissions
6. Click **Generate**
7. **Copy the API key** (you won't see it again!)

---

## Step 3: Create Your Waitlist

1. In Brevo, go to: **Contacts** → **Lists**
   OR
   Direct link: https://app.brevo.com/lists
2. Click **"Create a list"**
3. Choose **"Regular list"**
4. Enter details:
   - **Name**: `Aura Wellness Waitlist`
   - **Description**: `Newsletter subscribers interested in booking`
5. Click **"Create"**
6. **Find your List ID**:
   - Look at the URL: `https://app.brevo.com/lists/12345`
   - The number at the end (`12345`) is your List ID
   - Copy this number

---

## Step 4: Add Credentials to Your Project

1. Open the file `.env.local` in your project root
2. Replace the placeholder values with your actual credentials:

```env
BREVO_API_KEY=xkeysib-your-actual-api-key-here
BREVO_LIST_ID=your-actual-list-id-here
```

**Example:**
```env
BREVO_API_KEY=xkeysib-1234567890abcdef1234567890abcdef
BREVO_LIST_ID=12345
```

3. **Save the file**

---

## Step 5: Restart Your Development Server

The environment variables are loaded when the server starts, so you need to restart:

1. Stop your current dev server (Ctrl+C)
2. Start it again:
   ```bash
   npm run dev
   ```

---

## Step 6: Test the Integration

1. Visit your website: `http://localhost:4000`
2. Scroll to the footer where the email capture form is
3. Enter an email address
4. Check the checkbox
5. Click **"Join the List"**

**Expected behavior:**
- You should see a success message
- The email should appear in your Brevo list
- Check Brevo dashboard to confirm

---

## Troubleshooting

### Issue: "Server configuration error"
- **Problem**: Missing environment variables
- **Solution**: Make sure `.env.local` has both `BREVO_API_KEY` and `BREVO_LIST_ID` set
- **Fix**: Restart the dev server after adding credentials

### Issue: "Failed to subscribe"
- **Problem**: Invalid API key or list ID
- **Solution**: 
  - Double-check your API key in `.env.local`
  - Verify your List ID is correct
  - Make sure there are no extra spaces

### Issue: "Invalid email address"
- **Problem**: Email format is wrong
- **Solution**: Enter a valid email like `test@example.com`

### Debug Mode
Check browser console (F12) for detailed error messages if something goes wrong.

---

## What Happens Next?

When someone fills out the email capture form:

1. ✅ Their email is added to your Brevo waitlist
2. ✅ You can see them in Brevo dashboard
3. ✅ You can send them emails about:
   - Booking launch date
   - Special opening offers
   - Service announcements

---

## Using Brevo Features

### Send Your First Email

1. Go to: https://app.brevo.com/templates
2. Click **"Create an email"**
3. Choose a template or start from scratch
4. Design your launch announcement
5. Click **"Send"** or **"Schedule"**
6. Select your list: **"Aura Wellness Waitlist"**
7. Click **"Send to X contacts"**

### Automation (Free Plan)

Set up automated emails:
- Welcome email when someone joins
- Reminder emails before launch
- etc.

Go to: https://app.brevo.com/campaigns → **Automation**

---

## Limits on Free Plan

- ✅ **300 emails per day**
- ✅ Unlimited contacts
- ✅ Email automation
- ✅ Landing pages
- ✅ SMS marketing (separate limits)

**This is perfect for a small business!**

---

## Upgrading Later

When you outgrow 300 emails/day:
- **Essential Plan**: $25/month → 20,000 emails/month
- More contacts and advanced features
- Easily upgrade from your dashboard

---

## Support

- **Brevo Help**: https://help.brevo.com
- **API Docs**: https://developers.brevo.com
- **Your website**: Uses the `/api/subscribe` endpoint

---

## Quick Reference

| Item | Where to Find |
|------|--------------|
| API Key | https://app.brevo.com/settings/keys/api |
| List ID | https://app.brevo.com/lists (in URL) |
| Dashboard | https://app.brevo.com |
| Your credentials | `.env.local` file in project root |

---

**Ready to go! Your website is now connected to Brevo. 🎉**

