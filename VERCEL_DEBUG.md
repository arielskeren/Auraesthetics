# Debug Brevo Integration in Vercel

## Check Vercel Function Logs

1. Go to: https://vercel.com/dashboard
2. Click your **Auraesthetics** project
3. Click **Deployments** tab
4. Click on the latest deployment
5. Click **"Functions"** tab
6. Click on `/api/subscribe`
7. Click **"View Function Logs"**

You should see console.log output including:
- "Checking credentials:"
- "Sending to Brevo:"
- "Brevo response status:"
- "Brevo response body:"

## What to Look For

### If you see "Checking credentials:" with false values
- Environment variables are not set correctly
- Go to Settings → Environment Variables and re-add them

### If you see "Brevo response status: 201"
- Contact was created successfully
- But might not be in the list you expect
- Check: List ID might be wrong

### If you see "Brevo response status: 200"
- Contact already exists
- Might be using a different email

### If you see error messages
- API key might be wrong
- Request format might be incorrect

---

## Verify Your List ID

1. Go to: https://app.brevo.com/lists
2. Find your list
3. Click on it
4. Look at the URL: `https://app.brevo.com/lists/12345`
5. The number at the end is your List ID
6. In Vercel, make sure `BREVO_LIST_ID` matches this number

---

## Common Issues

### Contact added but name is empty
- Brevo might not have attribute columns created
- Go to Brevo → Contacts → View a contact
- Check if FIRSTNAME and LASTNAME columns exist
- If not, you may need to create them

### Contact not appearing in list
- List ID might be wrong
- Contact might be in a different list
- Check Brevo → Contacts (all contacts, not just the list)

### No errors but nothing happens
- Check Vercel logs
- API call might be succeeding but contact isn't being added to the list

---

## Quick Test

Create a simple test contact in Brevo manually:
1. Go to: https://app.brevo.com/contacts
2. Click "Create contact"
3. Add email, first name, last name
4. Add to your list
5. See if name appears

If manual contact works but API doesn't, the API format might be wrong.

---

**Check those Vercel logs first and share what you see!**

