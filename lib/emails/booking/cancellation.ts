/**
 * Booking cancellation email template
 * Uses shared design system for consistent styling
 */

import { getEmailStyles, EMAIL_STYLES } from '../_shared/styles';
import { escapeHtml, formatDateForEmail, generateEmailHead, generateEmailHeader } from '../_shared/utils';

export function generateBookingCancellationEmail(params: {
  serviceName: string;
  serviceImageUrl?: string | null;
  clientName?: string | null;
  bookingDate: Date;
  bookingTime: string; // Formatted time string
  refundProcessed: boolean;
  refundAmount?: number | null; // in dollars
  refundId?: string | null;
  receiptUrl?: string | null; // Stripe receipt URL
  refundReason?: string | null; // Reason for refund
  address?: string;
  bookingId?: string; // Internal booking ID or Hapio booking ID
  bookUrl?: string;
}) {
  const {
    serviceName,
    serviceImageUrl,
    clientName,
    bookingDate,
    bookingTime,
    refundProcessed,
    refundAmount,
    refundId,
    receiptUrl,
    refundReason,
    address = EMAIL_STYLES.defaultAddress,
    bookingId,
    bookUrl = EMAIL_STYLES.urls.book,
  } = params;

  const styles = getEmailStyles();
  const formattedDate = formatDateForEmail(bookingDate);
  const refundAmountFormatted = refundAmount != null ? `$${refundAmount.toFixed(2)}` : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
${generateEmailHead('Booking Cancellation - Aura Aesthetics')}
</head>
<body style="${styles.body}">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.background}; padding: 0;">
    <tr>
      <td align="center" style="padding: ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.sm};">
        <table role="presentation" style="${styles.container}">
          
${generateEmailHeader(styles)}

          <!-- Cancellation Message -->
          <tr>
            <td style="padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg}; text-align: center;">
              <h2 style="${styles.h2}">Booking Cancelled</h2>
              ${clientName ? `<p style="margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; ${styles.bodyText}">Dear ${escapeHtml(clientName)},</p>` : ''}
              <p style="margin: 0; ${styles.bodyText}">We're sorry to see you go. Your appointment has been cancelled as requested.</p>
            </td>
          </tr>

          <!-- Cancelled Service Details Card -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg};">
              <table role="presentation" style="width: 100%; border-collapse: collapse; ${styles.card}">
                <tr>
                  ${serviceImageUrl ? `
                  <td style="padding: ${EMAIL_STYLES.spacing.md}; text-align: center; background-color: ${EMAIL_STYLES.colors.white};">
                    <img src="${escapeHtml(serviceImageUrl)}" alt="${escapeHtml(serviceName)}" style="max-width: 200px; width: 100%; height: auto; border-radius: ${EMAIL_STYLES.layout.borderRadius}; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: block; margin: 0 auto; opacity: 0.7;" />
                  </td>
                  ` : ''}
                </tr>
                <tr>
                  <td style="padding: ${serviceImageUrl ? `0 ${EMAIL_STYLES.spacing.md} ${EMAIL_STYLES.spacing.md} ${EMAIL_STYLES.spacing.md}` : EMAIL_STYLES.spacing.md}; text-align: center;">
                    <h3 style="${styles.h3}">${escapeHtml(serviceName)}</h3>
                    <p style="margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; ${styles.smallText}">Cancelled Appointment Details:</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: ${EMAIL_STYLES.spacing.md};">
                      <tr>
                        <td style="padding: 12px; background-color: ${EMAIL_STYLES.colors.white}; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall}; text-align: center; margin-bottom: ${EMAIL_STYLES.spacing.sm};">
                          <p style="margin: 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.label}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">Date</p>
                          <p style="margin: 5px 0 0 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">${formattedDate}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px; background-color: ${EMAIL_STYLES.colors.white}; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall}; text-align: center; margin-top: ${EMAIL_STYLES.spacing.sm};">
                          <p style="margin: 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.label}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">Time</p>
                          <p style="margin: 5px 0 0 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">${escapeHtml(bookingTime)} EST</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Refund Information -->
          ${refundProcessed ? `
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg};">
              <table role="presentation" style="width: 100%; border-collapse: collapse; ${styles.infoBox}">
                <tr>
                  <td>
                    <h4 style="${styles.h4}">✓ Refund Processed</h4>
                    <p style="margin: 0 0 8px 0; ${styles.smallText}">
                      <strong>Refund Amount:</strong> ${refundAmountFormatted || 'N/A'}
                    </p>
                    ${refundId ? `
                    <p style="margin: 0 0 8px 0; ${styles.smallText}">
                      <strong>Refund ID:</strong> ${escapeHtml(refundId)}
                    </p>
                    ` : ''}
                    ${refundReason ? `
                    <p style="margin: 0 0 8px 0; ${styles.smallText}">
                      <strong>Reason:</strong> ${escapeHtml(refundReason)}
                    </p>
                    ` : ''}
                    <p style="margin: 8px 0 0 0; ${styles.xsmallText}">
                      Your refund has been processed and should appear in your account within 5-10 business days, depending on your bank's processing time.
                    </p>
                    <p style="margin: ${EMAIL_STYLES.spacing.sm} 0 0 0; ${styles.xsmallText} font-style: italic;">
                      <strong>Note:</strong> You will receive a separate refund receipt email from Stripe with your official receipt.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : `
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg};">
              <table role="presentation" style="width: 100%; border-collapse: collapse; ${styles.warningBox}">
                <tr>
                  <td>
                    <h4 style="${styles.h4}">No Refund Issued</h4>
                    <p style="margin: 0; ${styles.smallText}">
                      This booking was cancelled but no refund was processed. If you believe this is an error, please contact us.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `}

          <!-- Book Again Button -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg}; text-align: center;">
              <a href="${bookUrl}" style="${styles.button.primary}">Book Another Appointment</a>
            </td>
          </tr>

          <!-- Booking ID -->
          ${bookingId ? `
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg}; border-top: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border};">
              <p style="margin: 0; ${styles.xsmallText} text-align: center;">
                <strong>Booking ID:</strong> ${escapeHtml(bookingId)}
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="${styles.footer}">
              <p style="margin: 0 0 ${EMAIL_STYLES.spacing.sm} 0; ${styles.bodyText}">
                We hope to see you again soon. If you have any questions, please don't hesitate to contact us.
              </p>
              <p style="margin: 0; ${styles.bodyText}">
                <strong>Aura Aesthetics</strong><br />
                ${escapeHtml(address)}<br />
                <a href="${EMAIL_STYLES.urls.base}" style="color: ${EMAIL_STYLES.colors.primary}; text-decoration: none;">www.theauraesthetics.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

