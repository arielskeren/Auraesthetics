# Service Photos Guide

## Quick Setup

Add photos to `/public/services/` using service slug as filename.

## Photo Requirements

- **Format**: `.jpg`, `.png`, or `.webp`
- **Size**: 800-1200px wide, 4:3 aspect ratio
- **Naming**: Must match `slug` from `services.json`

## Service Slugs

**Facials:**
- `aura-facial.jpg`, `anti-aging-facial.jpg`, `hydrafacial.jpg`
- `glass-skin-facial.jpg`, `signature-detox-facial.jpg`
- `classic-european-facial.jpg`, `lymphatic-drainage-facial.jpg`, `buccal-massage.jpg`

**Advanced:**
- `dermaplaning.jpg`, `biorepeel.jpg`, `microneedling.jpg`

**Brows & Lashes:**
- `brow-lamination.jpg`, `classic-lash-extension.jpg`
- `hybrid-lash-extension.jpg`, `lash-lift-and-tint.jpg`

**Waxing:**
- `bikini-wax.jpg`, `brazilian-wax.jpg`, `eyebrow-wax.jpg`

## How It Works

1. System looks for photo using service slug
2. Displays photo if found
3. Falls back to gradient placeholder if missing

## Testing

After adding photos, restart dev server and check `/services` page.

