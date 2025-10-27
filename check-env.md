# Check Vercel Environment Variables

The 401 error means your API key is invalid or missing. 

## Double-Check Your Variables in Vercel

Go to: https://vercel.com/dashboard

1. Click your **Auraesthetics** project
2. Click **Settings** → **Environment Variables**
3. Verify these EXACT variables exist:

```
BREVO_API_KEY=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
BREVO_LIST_ID=3
```

## Common Issues:

### Issue 1: Missing Quotation Marks
❌ `BREVO_API_KEY=xkeysib-108...`
✅ No quotes needed in Vercel UI

### Issue 2: Extra Spaces
❌ `BREVO_API_KEY = xkeysib-108...`
✅ No spaces around the `=`

### Issue 3: Not Enabled for Production
- Make sure you check **Production**, **Preview**, AND **Development**
- Environment variables are scoped by environment

### Issue 4: Redeploy After Adding
- After adding/editing variables, click **"Redeploy"**
- Or go to **Deployments** → Latest → **Redeploy**

---

## Verify API Key in Brevo

1. Go to: https://app.brevo.com/settings/keys/api
2. Make sure your API key hasn't been revoked
3. If it was, create a new one and update in Vercel

---

## After Fixing

1. Save the environment variables
2. Redeploy in Vercel
3. Test the form again at theauraesthetics.com

---

**The 401 error specifically means "Unauthorized" - your API key is wrong or missing.**
