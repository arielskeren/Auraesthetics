/**
 * Shared email design system and styles
 * Ensures all email templates follow the same design language
 */

export const EMAIL_STYLES = {
  // Colors - Warm & Modern palette matching site
  colors: {
    primary: '#B7C8B1', // dark-sage
    primaryDark: '#3F3A37', // charcoal
    primaryLight: '#C9D2C0', // sage
    secondary: '#6B635B', // warm-gray
    background: '#F8F6F2', // ivory
    cardBackground: '#E9E2D8', // sand
    white: '#ffffff',
    border: '#D5DFD0', // sage-light
    success: '#B7C8B1', // dark-sage
    successBg: '#F0F7F1',
    error: '#D97777',
    errorBg: '#FFF5F5',
    warning: '#B6A999', // taupe
    warningBg: '#F9F7F4',
    accent: '#9FAA9A', // sage-dark
  },
  
  // Typography - Matching site fonts
  typography: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontFamilySerif: "'Cormorant Garamond', Georgia, serif",
    fontSize: {
      h1: '32px',
      h2: '28px',
      h3: '24px',
      h4: '18px',
      body: '16px',
      small: '14px',
      xsmall: '12px',
      label: '11px',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
    },
    lineHeight: {
      tight: '1.3',
      normal: '1.6',
      relaxed: '1.7',
    },
  },
  
  // Spacing
  spacing: {
    xs: '5px',
    sm: '10px',
    md: '15px',
    lg: '20px',
    xl: '25px',
    xxl: '30px',
    xxxl: '40px',
  },
  
  // Layout
  layout: {
    maxWidth: '650px',
    borderRadius: '12px',
    borderRadiusSmall: '8px',
    borderRadiusPill: '50px',
    boxShadow: '0 4px 12px rgba(63, 58, 55, 0.08)',
    borderWidth: '1px',
    borderLeftWidth: '4px',
  },
  
  // Gradients
  gradients: {
    header: 'linear-gradient(135deg, #B7C8B1 0%, #C9D2C0 100%)',
    accent: 'linear-gradient(135deg, #E9E2D8 0%, #F8F6F2 100%)',
  },
  
  // Address
  defaultAddress: '2998 Green Palm Court, Dania Beach, FL, 33312',
  
  // URLs
  urls: {
    base: 'https://www.theauraesthetics.com',
    manageBooking: 'https://www.theauraesthetics.com/manage-booking',
    book: 'https://www.theauraesthetics.com/book',
    instagram: 'https://instagram.com/wellnessesthetics_',
    tiktok: 'https://tiktok.com/@wellnessaesthetics_',
  },
} as const;

/**
 * Generate inline styles for common email elements
 */
export function getEmailStyles() {
  return {
    body: `margin: 0; padding: 0; font-family: ${EMAIL_STYLES.typography.fontFamily}; background-color: ${EMAIL_STYLES.colors.background}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`,
    container: `max-width: ${EMAIL_STYLES.layout.maxWidth}; width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.white}; border-radius: ${EMAIL_STYLES.layout.borderRadius}; overflow: hidden; box-shadow: ${EMAIL_STYLES.layout.boxShadow};`,
    header: `background: ${EMAIL_STYLES.gradients.header}; padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.lg}; text-align: center;`,
    h1: `margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-family: ${EMAIL_STYLES.typography.fontFamilySerif}; font-size: ${EMAIL_STYLES.typography.fontSize.h1}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; letter-spacing: 0.5px;`,
    h2: `margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-family: ${EMAIL_STYLES.typography.fontFamilySerif}; font-size: ${EMAIL_STYLES.typography.fontSize.h2}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; line-height: ${EMAIL_STYLES.typography.lineHeight.tight};`,
    h3: `margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-family: ${EMAIL_STYLES.typography.fontFamilySerif}; font-size: ${EMAIL_STYLES.typography.fontSize.h3}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; line-height: ${EMAIL_STYLES.typography.lineHeight.tight};`,
    h4: `margin: 0 0 ${EMAIL_STYLES.spacing.sm} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.h4}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};`,
    bodyText: `margin: 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.body}; line-height: ${EMAIL_STYLES.typography.lineHeight.relaxed};`,
    smallText: `margin: 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; line-height: ${EMAIL_STYLES.typography.lineHeight.normal};`,
    xsmallText: `margin: 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.xsmall}; line-height: ${EMAIL_STYLES.typography.lineHeight.normal};`,
    card: `background-color: ${EMAIL_STYLES.colors.cardBackground}; border-radius: ${EMAIL_STYLES.layout.borderRadius}; overflow: hidden; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border};`,
    infoBox: `background-color: ${EMAIL_STYLES.colors.successBg}; border-left: ${EMAIL_STYLES.layout.borderLeftWidth} solid ${EMAIL_STYLES.colors.success}; padding: ${EMAIL_STYLES.spacing.md}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};`,
    warningBox: `background-color: ${EMAIL_STYLES.colors.warningBg}; border-left: ${EMAIL_STYLES.layout.borderLeftWidth} solid ${EMAIL_STYLES.colors.warning}; padding: ${EMAIL_STYLES.spacing.md}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};`,
    button: {
      primary: `display: inline-block; padding: 14px 32px; background-color: ${EMAIL_STYLES.colors.primaryDark}; color: ${EMAIL_STYLES.colors.white}; text-decoration: none; border-radius: ${EMAIL_STYLES.layout.borderRadiusPill}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; text-align: center; box-sizing: border-box;`,
      secondary: `display: inline-block; padding: 14px 32px; background-color: ${EMAIL_STYLES.colors.white}; color: ${EMAIL_STYLES.colors.primaryDark}; text-decoration: none; border: 2px solid ${EMAIL_STYLES.colors.primaryDark}; border-radius: ${EMAIL_STYLES.layout.borderRadiusPill}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; text-align: center; box-sizing: border-box;`,
      danger: `display: inline-block; padding: 14px 32px; background-color: ${EMAIL_STYLES.colors.white}; color: ${EMAIL_STYLES.colors.error}; text-decoration: none; border: 2px solid ${EMAIL_STYLES.colors.error}; border-radius: ${EMAIL_STYLES.layout.borderRadiusPill}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; text-align: center; box-sizing: border-box;`,
      calendar: `display: inline-block; padding: 12px 24px; color: ${EMAIL_STYLES.colors.white}; text-decoration: none; border-radius: ${EMAIL_STYLES.layout.borderRadiusPill}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; text-align: center; box-sizing: border-box;`,
    },
    footer: `background-color: ${EMAIL_STYLES.colors.cardBackground}; padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.lg}; text-align: center; border-top: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border};`,
  };
}

