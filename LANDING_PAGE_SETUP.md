# Landing Page Setup

## Overview
The site now has a password-protected landing page that shows the welcome offer full-screen. Users must sign in as admin to access the main site.

## Features

### Landing Page (`/landing`)
- Full-screen welcome offer with email capture
- Admin sign-in button in top right
- About page information displayed after welcome offer is dismissed
- No navigation bar or footer (clean landing experience)

### Password Protection
- Default password: `aura2024`
- Can be customized via environment variable: `NEXT_PUBLIC_ADMIN_PASSWORD`
- Authentication stored in localStorage and cookies
- 24-hour session duration

### Authentication Flow
1. User visits any route → Redirected to `/landing`
2. Landing page shows full-screen welcome offer
3. User can either:
   - Submit the welcome offer form
   - Skip the offer to see about information
4. To access main site, user must click "Admin Sign In" and enter password
5. After authentication, redirected to home page
6. All routes (except `/landing`) are protected

## Configuration

### Environment Variables
Add to `.env.local`:
```env
NEXT_PUBLIC_ADMIN_PASSWORD=your_custom_password_here
```

If not set, defaults to `aura2024`.

## Components Created

1. **LandingClient** (`app/landing/LandingClient.tsx`)
   - Main landing page component
   - Shows welcome offer or about content

2. **LandingWelcomeOffer** (`app/_components/LandingWelcomeOffer.tsx`)
   - Full-screen welcome offer component
   - Replaces the popup version on landing page

3. **AdminSignIn** (`app/_components/AdminSignIn.tsx`)
   - Admin authentication component
   - Shows sign-in button or admin status

4. **ConditionalLayout** (`app/_components/ConditionalLayout.tsx`)
   - Conditionally shows Nav/Footer based on route
   - Hides Nav/Footer on landing page

5. **Middleware** (`middleware.ts`)
   - Protects all routes except `/landing`
   - Redirects unauthenticated users to landing page

## Routes

- `/landing` - Public landing page with welcome offer
- `/` - Home page (protected, requires auth)
- `/about`, `/services`, `/book`, etc. - All protected (require auth)

## Testing

1. Visit `http://localhost:6060` → Should redirect to `/landing`
2. Welcome offer should show full-screen
3. Click "Admin Sign In" in top right
4. Enter password: `aura2024` (or your custom password)
5. Should redirect to home page
6. All navigation should work normally

## Customization

- **Change password**: Set `NEXT_PUBLIC_ADMIN_PASSWORD` in `.env.local`
- **Adjust welcome offer**: Edit `app/_components/LandingWelcomeOffer.tsx`
- **Modify about content**: Edit `app/landing/LandingClient.tsx`
- **Change session duration**: Edit cookie `max-age` in `AdminSignIn.tsx`

