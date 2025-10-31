# How to Add Service Photos

## Quick Summary
Add service photos to `/public/services/` and the site will automatically display them instead of gradient placeholders.

---

## Step-by-Step Instructions

### 1. Add Your Photos
Place photos in: **`public/services/`**

Use the service slug as the filename:
- `aura-facial.jpg` for "The Aura Facial"
- `hydrafacial.jpg` for "HydraFacial"
- `anti-aging-facial.jpg` for "Anti-aging Facial"
- `glass-skin-facial.jpg` for "Glass Skin Facial"
- etc.

### 2. Photo Requirements
- **Format**: `.jpg`, `.png`, or `.webp`
- **Recommended size**: 800-1200px wide, 4:3 aspect ratio
- **File naming**: Must match the `slug` field from services.json

### 3. Photo Slug Reference
Here are all the service slugs from your `services.json`:

**Facials:**
- `aura-facial.jpg`
- `anti-aging-facial.jpg`
- `hydrafacial.jpg`
- `glass-skin-facial.jpg`
- `signature-detox-facial.jpg`
- `classic-european-facial.jpg`
- `lymphatic-drainage-facial.jpg`
- `buccal-massage.jpg`

**Advanced:**
- `dermaplaning.jpg`
- `biorepeel.jpg`
- `microneedling.jpg`

**Brows & Lashes:**
- `brow-lamination.jpg`
- `classic-lash-extension.jpg`
- `hybrid-lash-extension.jpg`
- `lash-lift-and-tint.jpg`

**Waxing:**
- `bikini-wax.jpg`
- `brazilian-wax.jpg`
- `eyebrow-wax.jpg`

### 4. How It Works
The system will:
1. Look for photos in `/public/services/` using the slug
2. Display the photo if it exists
3. **Automatically fallback** to the gradient placeholder if the photo doesn't exist

### 5. Testing
After adding photos:
1. Restart the dev server
2. Visit http://localhost:1024/services or http://localhost:1024
3. Photos should appear automatically!

### 6. Already Done!
✅ Created `/public/services/` directory
✅ Updated ServiceCard component to display photos
✅ Added automatic fallback to gradient placeholders

---

## Example
```bash
# Add a photo for "The Aura Facial"
# File: public/services/aura-facial.jpg

# Add a photo for "HydraFacial"  
# File: public/services/hydrafacial.jpg
```

That's it! The site will automatically pick up the photos and display them.

