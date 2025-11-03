# Instagram Feed Integration Setup

## Overview
This guide will help you set up the Instagram feed on your website to display your latest Instagram posts.

## Prerequisites
1. An Instagram Business Account or Creator Account
2. A Facebook Page connected to your Instagram account
3. A Facebook Developer account

## Step-by-Step Setup

### 1. Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **"My Apps"** → **"Create App"**
3. Choose **"Business"** as the app type
4. Fill in:
   - App Name: `Aura Wellness Aesthetics` (or your preferred name)
   - Contact Email: Your email
   - Business Account (optional)
5. Click **"Create App"**

### 2. Add Instagram Product

1. In your app dashboard, go to **"Products"** in the left sidebar
2. Find **"Instagram"** and click **"Set Up"**
3. You'll be taken to the Instagram product page

### 3. Get Your Instagram User ID

1. Go to [Instagram Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. In the dropdown at the top, select your app
3. Click **"Get Token"** → **"Get User Access Token"**
4. Select these permissions:
   - `instagram_basic`
   - `pages_show_list`
   - `instagram_content_publish` (optional, for future posting)
5. Click **"Generate Access Token"**
6. In the response, find your Instagram User ID (looks like: `17841405309211844`)

### 4. Generate Long-Lived Access Token

**Option A: Using Graph API Explorer (Quick but expires)**
1. Use the token from step 3
2. Test it: `GET /me?fields=id,name`

**Option B: Generate Long-Lived Token (Recommended)**
1. Make a GET request to:
   ```
   https://graph.facebook.com/v18.0/oauth/access_token?
     grant_type=fb_exchange_token&
     client_id={your-app-id}&
     client_secret={your-app-secret}&
     fb_exchange_token={short-lived-token}
   ```
   Replace:
   - `{your-app-id}` - Found in your app settings
   - `{your-app-secret}` - Found in your app settings → Settings → Basic
   - `{short-lived-token}` - The token from step 3

2. The response will contain a `access_token` that lasts ~60 days

### 5. Test Your Access Token

Test with this URL (replace `{access-token}` and `{user-id}`):
```
https://graph.instagram.com/{user-id}/media?fields=id,media_type,media_url,permalink,caption&access_token={access-token}
```

You should see a JSON response with your Instagram posts.

### 6. Add Environment Variables

Add to your `.env.local` file:
```env
INSTAGRAM_ACCESS_TOKEN=your_long_lived_access_token_here
INSTAGRAM_USER_ID=your_instagram_user_id_here
```

### 7. Refresh Token Setup (Important!)

Instagram tokens expire after ~60 days. To avoid this:

**Option A: Manual Refresh (Simple)**
- Set a reminder to refresh the token every 50 days
- Follow step 4 again

**Option B: Automated Refresh (Advanced)**
- Create a scheduled task/API endpoint that refreshes the token
- Store token in a database
- Auto-refresh before expiration

## Troubleshooting

### Error: "Invalid OAuth access token"
- Token may have expired
- Regenerate following step 4

### Error: "User not authorized"
- Make sure your Instagram account is a Business/Creator account
- Verify the account is connected to a Facebook Page
- Check that you've accepted the app permissions

### Error: "Permission denied"
- Ensure you've selected the correct permissions in step 3
- Re-authenticate if needed

### Feed shows "coming soon" message
- Check that environment variables are set correctly
- Verify the API route is working: `http://localhost:6060/api/instagram`
- Check browser console for errors

## Testing

1. Start your dev server: `npm run dev`
2. Visit: `http://localhost:6060/api/instagram`
3. You should see JSON with your posts
4. Visit the home page to see the feed

## Production Deployment

Make sure to add the environment variables to your hosting platform:

**Vercel:**
1. Go to Project Settings → Environment Variables
2. Add `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_USER_ID`
3. Redeploy

## Alternative: Third-Party Services

If the API setup is too complex, consider:
- **SnapWidget** - Easy embed, free tier available
- **EmbedSocial** - Professional feeds
- **Elfsight** - Instagram widget

These services handle the API complexity but may have limitations or costs.

## Security Notes

- **Never commit** your access token to git
- Use environment variables only
- Rotate tokens regularly
- Consider implementing token refresh automation

## Support

If you encounter issues:
1. Check [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api)
2. Verify token permissions in [Facebook Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
3. Check API status at [Facebook Platform Status](https://developers.facebook.com/status/)

