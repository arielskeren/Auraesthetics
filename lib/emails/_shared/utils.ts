/**
 * Shared utilities for email templates
 */

import { EST_TIMEZONE } from '../../timezone';
import { EMAIL_STYLES } from './styles';

/**
 * Escape HTML to prevent XSS attacks
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format date for email display
 */
export function formatDateForEmail(date: Date, timezone: string = EST_TIMEZONE): string {
  return date.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time for email display
 */
export function formatTimeForEmail(date: Date, timezone: string = EST_TIMEZONE): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Generate email HTML head section
 */
export function generateEmailHead(title: string): string {
  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->`;
}

/**
 * Generate email header section with centered logo text
 */
export function generateEmailHeader(styles: ReturnType<typeof import('./styles').getEmailStyles>): string {
  return `
          <!-- Header with Logo -->
          <tr>
            <td style="${styles.header}">
              <h1 style="${styles.h1}">The Aura Esthetics</h1>
            </td>
          </tr>`;
}

/**
 * Generate email footer with social links
 */
export function generateEmailFooterWithSocial(
  address: string,
  styles: ReturnType<typeof import('./styles').getEmailStyles>
): string {
  return `
          <!-- Footer -->
          <tr>
            <td style="${styles.footer}">
              <p style="margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; ${styles.bodyText}">
                If you have any questions or need to make changes, please don't hesitate to contact us.
              </p>
              <p style="margin: 0 0 ${EMAIL_STYLES.spacing.lg} 0; ${styles.bodyText}">
                <strong style="font-family: ${EMAIL_STYLES.typography.fontFamilySerif}; color: ${EMAIL_STYLES.colors.primaryDark};">The Aura Esthetics</strong><br />
                ${escapeHtml(address)}<br />
                <a href="${EMAIL_STYLES.urls.base}" style="color: ${EMAIL_STYLES.colors.primary}; text-decoration: none;">www.theauraesthetics.com</a>
              </p>
              
              <!-- Social Links -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: ${EMAIL_STYLES.spacing.lg} 0 0 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <table role="presentation" style="border-collapse: collapse; margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 ${EMAIL_STYLES.spacing.sm};">
                          <a href="${EMAIL_STYLES.urls.instagram}" style="display: inline-block; color: ${EMAIL_STYLES.colors.primaryDark}; text-decoration: none; font-size: ${EMAIL_STYLES.typography.fontSize.small};">
                            Instagram
                          </a>
                        </td>
                        <td style="padding: 0 ${EMAIL_STYLES.spacing.sm};">
                          <a href="${EMAIL_STYLES.urls.tiktok}" style="display: inline-block; color: ${EMAIL_STYLES.colors.primaryDark}; text-decoration: none; font-size: ${EMAIL_STYLES.typography.fontSize.small};">
                            TikTok
                          </a>
                        </td>
                        <td style="padding: 0 ${EMAIL_STYLES.spacing.sm};">
                          <a href="${EMAIL_STYLES.urls.base}" style="display: inline-block; color: ${EMAIL_STYLES.colors.primaryDark}; text-decoration: none; font-size: ${EMAIL_STYLES.typography.fontSize.small};">
                            Website
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/**
 * Generate email footer section
 */
export function generateEmailFooter(
  address: string,
  styles: ReturnType<typeof import('./styles').getEmailStyles>
): string {
  return `
          <!-- Footer -->
          <tr>
            <td style="${styles.footer}">
              <p style="${styles.bodyText}">
                If you have any questions or need to make changes, please don't hesitate to contact us.
              </p>
              <p style="${styles.bodyText}">
                <strong>Aura Aesthetics</strong><br />
                ${escapeHtml(address)}<br />
                <a href="${EMAIL_STYLES.urls.base}" style="color: ${EMAIL_STYLES.colors.primary}; text-decoration: none;">www.theauraesthetics.com</a>
              </p>
            </td>
          </tr>`;
}

