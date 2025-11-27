/**
 * Booking reschedule email template
 * Uses shared design system for consistent styling
 */

import { getEmailStyles, EMAIL_STYLES } from '../_shared/styles';
import { escapeHtml, formatDateForEmail, generateEmailHead, generateEmailHeader } from '../_shared/utils';

export function generateBookingRescheduleEmail(params: {
  serviceName: string;
  serviceImageUrl?: string | null;
  clientName?: string | null;
  oldBookingDate: Date;
  oldBookingTime: string;
  newBookingDate: Date;
  newBookingTime: string;
  address?: string;
  bookingId?: string; // Internal booking ID or Hapio booking ID
  bookUrl?: string;
  cancelUrl?: string;
}) {
  const {
    serviceName,
    serviceImageUrl,
    clientName,
    oldBookingDate,
    oldBookingTime,
    newBookingDate,
    newBookingTime,
    address = EMAIL_STYLES.defaultAddress,
    bookingId,
    bookUrl,
    cancelUrl,
  } = params;

  const styles = getEmailStyles();

  // Generate URLs with booking ID if provided
  const finalBookUrl = bookUrl || (bookingId ? `${EMAIL_STYLES.urls.manageBooking}?id=${encodeURIComponent(bookingId)}` : EMAIL_STYLES.urls.manageBooking);
  const finalCancelUrl = cancelUrl || (bookingId ? `${EMAIL_STYLES.urls.manageBooking}?id=${encodeURIComponent(bookingId)}` : EMAIL_STYLES.urls.manageBooking);

  const formattedOldDate = formatDateForEmail(oldBookingDate);
  const formattedNewDate = formatDateForEmail(newBookingDate);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
${generateEmailHead('Your Appointment Has Been Rescheduled - Aura Aesthetics')}
</head>
<body style="${styles.body}">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.background}; padding: 0;">
    <tr>
      <td align="center" style="padding: ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.sm};">
        <table role="presentation" style="${styles.container}">
          
${generateEmailHeader(styles)}

          <!-- Main Content -->
          <tr>
            <td style="padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.lg};">
              <h2 style="${styles.h2}">Your Appointment Has Been Rescheduled</h2>
              
              <p style="margin: 0 0 ${EMAIL_STYLES.spacing.lg} 0; ${styles.bodyText}">
                Hi ${escapeHtml(clientName || 'Valued Client')},
              </p>
              
              <p style="margin: 0 0 ${EMAIL_STYLES.spacing.lg} 0; ${styles.bodyText}">
                Your appointment has been rescheduled. Please see the updated details below:
              </p>

              <!-- Service Info Box -->
              <div style="background-color: ${EMAIL_STYLES.colors.cardBackground}; border-left: ${EMAIL_STYLES.layout.borderLeftWidth} solid ${EMAIL_STYLES.colors.primary}; padding: ${EMAIL_STYLES.spacing.lg}; margin: ${EMAIL_STYLES.spacing.lg} 0; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                <h3 style="margin: 0 0 ${EMAIL_STYLES.spacing.sm} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.h4}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">${escapeHtml(serviceName)}</h3>
              </div>

              <!-- Old Date/Time -->
              <div style="background-color: #fff3cd; border: ${EMAIL_STYLES.layout.borderWidth} solid #ffc107; padding: ${EMAIL_STYLES.spacing.md}; margin: ${EMAIL_STYLES.spacing.lg} 0; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                <p style="margin: 0 0 8px 0; color: #856404; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; text-transform: uppercase;">Previous Appointment</p>
                <p style="margin: 0; color: #856404; font-size: ${EMAIL_STYLES.typography.fontSize.body};">
                  <strong>${escapeHtml(formattedOldDate)}</strong> at <strong>${escapeHtml(oldBookingTime)} EST</strong>
                </p>
              </div>

              <!-- Arrow -->
              <div style="text-align: center; margin: ${EMAIL_STYLES.spacing.md} 0;">
                <span style="font-size: 24px; color: ${EMAIL_STYLES.colors.primary};">↓</span>
              </div>

              <!-- New Date/Time -->
              <div style="background-color: ${EMAIL_STYLES.colors.successBg}; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.success}; padding: ${EMAIL_STYLES.spacing.md}; margin: ${EMAIL_STYLES.spacing.lg} 0; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                <p style="margin: 0 0 8px 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; text-transform: uppercase;">New Appointment</p>
                <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body};">
                  <strong>${escapeHtml(formattedNewDate)}</strong> at <strong>${escapeHtml(newBookingTime)} EST</strong>
                </p>
              </div>

              <!-- Location -->
              <div style="background-color: ${EMAIL_STYLES.colors.cardBackground}; padding: ${EMAIL_STYLES.spacing.md}; margin: ${EMAIL_STYLES.spacing.lg} 0; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall}; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border};">
                <p style="margin: 0 0 5px 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">Location:</p>
                <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body};">${escapeHtml(address)}</p>
              </div>

              <!-- Action Buttons -->
              <table role="presentation" style="width: 100%; margin: ${EMAIL_STYLES.spacing.xxl} 0; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${escapeHtml(finalBookUrl)}" style="${styles.button.primary}">View Booking Details</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: ${EMAIL_STYLES.spacing.sm} 0 0 0;">
                    <a href="${escapeHtml(finalCancelUrl)}" style="display: inline-block; color: ${EMAIL_STYLES.colors.error}; text-decoration: none; font-size: ${EMAIL_STYLES.typography.fontSize.small};">Need to cancel or reschedule?</a>
                  </td>
                </tr>
              </table>

              <!-- Booking ID -->
              ${bookingId ? `
              <div style="border-top: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border}; padding-top: ${EMAIL_STYLES.spacing.lg}; margin-top: ${EMAIL_STYLES.spacing.xxl};">
                <p style="margin: 0; ${styles.xsmallText} text-align: center;">
                  <strong>Booking ID:</strong> ${escapeHtml(bookingId)}
                </p>
              </div>
              ` : ''}

              <!-- Footer -->
              <div style="border-top: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border}; padding-top: ${EMAIL_STYLES.spacing.lg}; margin-top: ${EMAIL_STYLES.spacing.xxl};">
                <p style="margin: 0 0 ${EMAIL_STYLES.spacing.sm} 0; ${styles.bodyText}">
                  We look forward to seeing you on <strong>${escapeHtml(formattedNewDate)}</strong> at <strong>${escapeHtml(newBookingTime)} EST</strong>!
                </p>
                <p style="margin: 0; ${styles.bodyText}">
                  If you have any questions or need to make changes, please don't hesitate to reach out.
                </p>
                <p style="margin: ${EMAIL_STYLES.spacing.lg} 0 0 0; color: #999999; font-size: ${EMAIL_STYLES.typography.fontSize.xsmall}; line-height: ${EMAIL_STYLES.typography.lineHeight.normal}; font-style: italic; text-align: center;">
                  Warm regards,<br>
                  <strong style="color: ${EMAIL_STYLES.colors.primaryDark};">Amy & The Aura Wellness Aesthetics Team</strong>
                </p>
              </div>
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

