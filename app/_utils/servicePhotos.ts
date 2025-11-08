/**
 * Service photo mapping
 * Maps service slugs to their actual photo filenames
 * Some photos have different names than their slugs
 */
export const SERVICE_PHOTO_MAP: Record<string, string> = {
  // Exact matches don't need mapping, but we list them for clarity
  'aura-facial': 'aura-facial',
  'anti-aging-facial': 'anti-aging-facial',
  'hydrafacial': 'hydrafacial',
  'signature-detox-facial': 'signature-detox-facial', // Also has detox-facial.jpg as fallback
  'lymphatic-drainage-facial': 'lymphatic-drainage-facial',
  'dermaplaning': 'dermaplaning',
  'biorepeel': 'biorepeel',
  'microneedling': 'microneedling',
  'oxygen-peel': 'oxygen-peel',
  'brow-lamination': 'brow-lamination',
  'brow-lamination-lash-lift-combo': 'brow-lamination-and-lash-lift',
  'brow-tint': 'brow-tint',
  'brow-wax-tint': 'brow-wax',
  'brow-wax': 'brow-wax',
  'glass-skin-facial': 'glass-skin-facial',
  
  // Mismatched names
  'lip-wax': 'upper-lip-wax',
  'lash-lift-tint': 'lash-lift',
};

/**
 * Get the photo filename for a service slug
 * Falls back to slug name if no mapping exists
 */
export function getServicePhotoPath(slug: string): string {
  const photoName = SERVICE_PHOTO_MAP[slug] || slug;
  return `/services/${photoName}.jpg`;
}

/**
 * Check if a service has a photo
 * Returns array of possible photo paths to try
 */
export function getServicePhotoPaths(slug: string): string[] {
  const primary = getServicePhotoPath(slug);
  const fallback = `/services/${slug}.jpg`;
  
  // Special case: signature-detox-facial can use either name
  if (slug === 'signature-detox-facial') {
    return [primary, '/services/detox-facial.jpg', fallback];
  }
  
  // Return primary, and fallback if different
  return primary !== fallback ? [primary, fallback] : [primary];
}

