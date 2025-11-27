/**
 * Booking cancellation email template
 * Warm & Modern design with hero image left, details right layout
 */

import { getEmailStyles, EMAIL_STYLES } from '../_shared/styles';
import { escapeHtml, formatDateForEmail, generateEmailHead, generateEmailHeader, generateEmailFooterWithSocial } from '../_shared/utils';

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
${generateEmailHead('Booking Cancellation - The Aura Esthetics')}
</head>
<body style="${styles.body}">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.background}; padding: 0;">
    <tr>
      <td align="center" style="padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.sm};">
        <table role="presentation" style="${styles.container}">
          
${generateEmailHeader(styles)}

          <!-- Cancellation Message -->
          <tr>
            <td style="padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg}; text-align: center;">
              <h2 style="${styles.h2}">Booking Cancelled</h2>
              ${clientName ? `<p style="margin: ${EMAIL_STYLES.spacing.sm} 0 ${EMAIL_STYLES.spacing.md} 0; ${styles.bodyText}">Dear ${escapeHtml(clientName)},</p>` : ''}
              <p style="margin: 0; ${styles.bodyText}">We're sorry to see you go. Your appointment has been cancelled as requested.</p>
            </td>
          </tr>

          <!-- Hero Image & Service Details - Two Column Layout -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg};">
              <table role="presentation" style="width: 100%; border-collapse: collapse; ${styles.card}">
                <tr>
                  ${serviceImageUrl ? `
                  <!-- Hero Image Column (Left) -->
                  <td style="width: 45%; padding: 0; vertical-align: top; background-color: ${EMAIL_STYLES.colors.white};">
                    <img src="${escapeHtml(serviceImageUrl)}" alt="${escapeHtml(serviceName)}" style="width: 100%; height: auto; display: block; border-radius: ${EMAIL_STYLES.layout.borderRadius} 0 0 ${EMAIL_STYLES.layout.borderRadius}; opacity: 0.7; filter: grayscale(30%);" />
                  </td>
                  ` : ''}
                  
                  <!-- Service Details Column (Right) -->
                  <td style="${serviceImageUrl ? 'width: 55%;' : 'width: 100%;'} padding: ${EMAIL_STYLES.spacing.xl}; vertical-align: top; background-color: ${EMAIL_STYLES.colors.cardBackground};">
                    <h3 style="margin: 0 0 ${EMAIL_STYLES.spacing.lg} 0; ${styles.h3}">${escapeHtml(serviceName)}</h3>
                    <p style="margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; ${styles.smallText} color: ${EMAIL_STYLES.colors.secondary};">Cancelled Appointment Details:</p>
                    
                    <!-- Date -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: ${EMAIL_STYLES.spacing.md};">
                      <tr>
                        <td style="padding: ${EMAIL_STYLES.spacing.md}; background-color: ${EMAIL_STYLES.colors.white}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="width: 28px; padding: 0; vertical-align: middle;">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 8px;"><path d="M6 2V4M14 2V4M3 6H17M4 4H16C16.5523 4 17 4.44772 17 5V16C17 16.5523 16.5523 17 16 17H4C3.44772 17 3 16.5523 3 16V5C3 4.44772 3.44772 4 4 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                              </td>
                              <td style="padding: 0; vertical-align: middle;">
                                <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold;">${formattedDate}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Time -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: ${EMAIL_STYLES.spacing.md}; background-color: ${EMAIL_STYLES.colors.white}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="width: 28px; padding: 0; vertical-align: middle;">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 8px;"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6V10L13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                              </td>
                              <td style="padding: 0; vertical-align: middle;">
                                <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold;">${escapeHtml(bookingTime)} EST</p>
                              </td>
                            </tr>
                          </table>
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
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: ${EMAIL_STYLES.spacing.sm};">
                      <tr>
                        <td style="width: 28px; padding: 0; vertical-align: middle;">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 8px;"><path d="M16.6667 5L7.50004 14.1667L3.33337 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </td>
                        <td style="padding: 0; vertical-align: middle;">
                          <h4 style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.h4}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold;">Refund Processed</h4>
                        </td>
                      </tr>
                    </table>
                    ${refundAmountFormatted ? `
                    <p style="margin: ${EMAIL_STYLES.spacing.sm} 0; ${styles.smallText}">
                      <strong>Refund Amount:</strong> ${refundAmountFormatted}
                    </p>
                    ` : ''}
                    ${refundId ? `
                    <p style="margin: ${EMAIL_STYLES.spacing.sm} 0; ${styles.smallText}">
                      <strong>Refund ID:</strong> ${escapeHtml(refundId)}
                    </p>
                    ` : ''}
                    ${refundReason ? `
                    <p style="margin: ${EMAIL_STYLES.spacing.sm} 0; ${styles.smallText}">
                      <strong>Reason:</strong> ${escapeHtml(refundReason)}
                    </p>
                    ` : ''}
                    <p style="margin: ${EMAIL_STYLES.spacing.md} 0 0 0; ${styles.xsmallText}">
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

${generateEmailFooterWithSocial(address, styles)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
