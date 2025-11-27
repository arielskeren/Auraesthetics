/**
 * Shared email design system and styles
 * Ensures all email templates follow the same design language
 */

export const EMAIL_STYLES = {
  // Colors
  colors: {
    primary: '#6B8E6F',
    primaryDark: '#2C3E2D',
    primaryLight: '#8B9A7A',
    secondary: '#5A5A5A',
    background: '#f5f5f0',
    cardBackground: '#F9F9F5',
    white: '#ffffff',
    border: '#E8E8E0',
    success: '#6B8E6F',
    successBg: '#F0F7F1',
    error: '#D97777',
    errorBg: '#FFF5F5',
    warning: '#D97777',
    warningBg: '#FFF5F5',
  },
  
  // Typography
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: {
      h1: '24px',
      h2: '22px',
      h3: '20px',
      h4: '16px',
      body: '16px',
      small: '14px',
      xsmall: '13px',
      label: '12px',
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
  },
  
  // Layout
  layout: {
    maxWidth: '600px',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    borderWidth: '1px',
    borderLeftWidth: '4px',
  },
  
  // Gradients
  gradients: {
    header: 'linear-gradient(135deg, #6B8E6F 0%, #8B9A7A 100%)',
  },
  
  // Address
  defaultAddress: '2998 Green Palm Court, Dania Beach, FL, 33312',
  
  // URLs
  urls: {
    base: 'https://www.theauraesthetics.com',
    manageBooking: 'https://www.theauraesthetics.com/manage-booking',
    book: 'https://www.theauraesthetics.com/book',
  },
} as const;

/**
 * Generate inline styles for common email elements
 */
export function getEmailStyles() {
  return {
    body: `margin: 0; padding: 0; font-family: ${EMAIL_STYLES.typography.fontFamily}; background-color: ${EMAIL_STYLES.colors.background}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`,
    container: `max-width: ${EMAIL_STYLES.layout.maxWidth}; width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.white}; border-radius: ${EMAIL_STYLES.layout.borderRadius}; overflow: hidden; box-shadow: ${EMAIL_STYLES.layout.boxShadow};`,
    header: `background: ${EMAIL_STYLES.gradients.header}; padding: ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg}; text-align: center;`,
    h1: `margin: 0; color: ${EMAIL_STYLES.colors.white}; font-size: ${EMAIL_STYLES.typography.fontSize.h1}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; letter-spacing: 1px;`,
    h2: `margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.h2}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; line-height: ${EMAIL_STYLES.typography.lineHeight.tight};`,
    h3: `margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.h3}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; line-height: ${EMAIL_STYLES.typography.lineHeight.tight};`,
    h4: `margin: 0 0 ${EMAIL_STYLES.spacing.sm} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.h4}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};`,
    bodyText: `margin: 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.body}; line-height: ${EMAIL_STYLES.typography.lineHeight.normal};`,
    smallText: `margin: 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; line-height: ${EMAIL_STYLES.typography.lineHeight.normal};`,
    xsmallText: `margin: 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.xsmall}; line-height: ${EMAIL_STYLES.typography.lineHeight.normal};`,
    card: `background-color: ${EMAIL_STYLES.colors.cardBackground}; border-radius: ${EMAIL_STYLES.layout.borderRadius}; overflow: hidden; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border};`,
    infoBox: `background-color: ${EMAIL_STYLES.colors.successBg}; border-left: ${EMAIL_STYLES.layout.borderLeftWidth} solid ${EMAIL_STYLES.colors.success}; padding: ${EMAIL_STYLES.spacing.md}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};`,
    warningBox: `background-color: ${EMAIL_STYLES.colors.warningBg}; border-left: ${EMAIL_STYLES.layout.borderLeftWidth} solid ${EMAIL_STYLES.colors.warning}; padding: ${EMAIL_STYLES.spacing.md}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};`,
    button: {
      primary: `display: inline-block; padding: 14px 24px; background-color: ${EMAIL_STYLES.colors.primary}; color: ${EMAIL_STYLES.colors.white}; text-decoration: none; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; width: 100%; max-width: 250px; box-sizing: border-box;`,
      secondary: `display: inline-block; padding: 14px 24px; background-color: ${EMAIL_STYLES.colors.white}; color: ${EMAIL_STYLES.colors.primary}; text-decoration: none; border: 2px solid ${EMAIL_STYLES.colors.primary}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; width: 100%; max-width: 250px; box-sizing: border-box;`,
      danger: `display: inline-block; padding: 14px 24px; background-color: ${EMAIL_STYLES.colors.white}; color: ${EMAIL_STYLES.colors.error}; text-decoration: none; border: 2px solid ${EMAIL_STYLES.colors.error}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; width: 100%; max-width: 250px; box-sizing: border-box;`,
      calendar: `display: inline-block; padding: 12px 20px; color: ${EMAIL_STYLES.colors.white}; text-decoration: none; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; width: 100%; max-width: 200px; box-sizing: border-box;`,
    },
    footer: `background-color: ${EMAIL_STYLES.colors.cardBackground}; padding: ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg}; text-align: center; border-top: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border};`,
  };
}

