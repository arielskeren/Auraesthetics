/**
 * Booking reschedule email template
 * Warm & Modern design with hero image left, details right layout
 */

import { getEmailStyles, EMAIL_STYLES } from '../_shared/styles';
import { escapeHtml, formatDateForEmail, generateEmailHead, generateEmailHeader, generateEmailFooterWithSocial } from '../_shared/utils';

// SVG Icons for email compatibility
const iconCalendar = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 8px;"><path d="M6 2V4M14 2V4M3 6H17M4 4H16C16.5523 4 17 4.44772 17 5V16C17 16.5523 16.5523 17 16 17H4C3.44772 17 3 16.5523 3 16V5C3 4.44772 3.44772 4 4 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const iconClock = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 8px;"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6V10L13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

const iconLocation = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 8px;"><path d="M10 10.5C11.3807 10.5 12.5 9.38071 12.5 8C12.5 6.61929 11.3807 5.5 10 5.5C8.61929 5.5 7.5 6.61929 7.5 8C7.5 9.38071 8.61929 10.5 10 10.5Z" stroke="currentColor" stroke-width="1.5"/><path d="M10 18C13 14 17 10.4183 17 8C17 4.68629 14.3137 2 11 2C7.68629 2 5 4.68629 5 8C5 10.4183 9 14 10 18Z" stroke="currentColor" stroke-width="1.5"/></svg>';

const iconArrow = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path d="M12 5V19M12 5L19 12M12 5L5 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
${generateEmailHead('Your Appointment Has Been Rescheduled - The Aura Esthetics')}
</head>
<body style="${styles.body}">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.background}; padding: 0;">
    <tr>
      <td align="center" style="padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.sm};">
        <table role="presentation" style="${styles.container}">
          
${generateEmailHeader(styles)}

          <!-- Main Content -->
          <tr>
            <td style="padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.lg};">
              <h2 style="${styles.h2}">Your Appointment Has Been Rescheduled</h2>
              
              <p style="margin: ${EMAIL_STYLES.spacing.md} 0 ${EMAIL_STYLES.spacing.lg} 0; ${styles.bodyText}">
                Hi ${escapeHtml(clientName || 'Valued Client')},
              </p>
              
              <p style="margin: 0 0 ${EMAIL_STYLES.spacing.lg} 0; ${styles.bodyText}">
                Your appointment has been rescheduled. Please see the updated details below:
              </p>

              <!-- Hero Image & Service Info -->
              ${serviceImageUrl ? `
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: ${EMAIL_STYLES.spacing.lg} 0; ${styles.card}">
                <tr>
                  <td style="width: 45%; padding: 0; vertical-align: top;">
                    <img src="${escapeHtml(serviceImageUrl)}" alt="${escapeHtml(serviceName)}" style="width: 100%; height: auto; display: block; border-radius: ${EMAIL_STYLES.layout.borderRadius} 0 0 ${EMAIL_STYLES.layout.borderRadius};" />
                  </td>
                  <td style="width: 55%; padding: ${EMAIL_STYLES.spacing.xl}; vertical-align: middle; background-color: ${EMAIL_STYLES.colors.cardBackground};">
                    <h3 style="margin: 0; ${styles.h3}">${escapeHtml(serviceName)}</h3>
                  </td>
                </tr>
              </table>
              ` : `
              <div style="background-color: ${EMAIL_STYLES.colors.cardBackground}; border-left: ${EMAIL_STYLES.layout.borderLeftWidth} solid ${EMAIL_STYLES.colors.primary}; padding: ${EMAIL_STYLES.spacing.lg}; margin: ${EMAIL_STYLES.spacing.lg} 0; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                <h3 style="margin: 0; ${styles.h3}">${escapeHtml(serviceName)}</h3>
              </div>
              `}

              <!-- Old Date/Time -->
              <div style="background-color: ${EMAIL_STYLES.colors.warningBg}; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.warning}; padding: ${EMAIL_STYLES.spacing.md}; margin: ${EMAIL_STYLES.spacing.lg} 0; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                <p style="margin: 0 0 ${EMAIL_STYLES.spacing.sm} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; text-transform: uppercase; letter-spacing: 0.5px;">Previous Appointment</p>
                <table role="presentation" style="width: 100%; border-collapse: collapse; margin: ${EMAIL_STYLES.spacing.xs} 0 0 0;">
                  <tr>
                    <td style="width: 28px; padding: 0; vertical-align: middle;">
` + iconCalendar + `
                    </td>
                    <td style="padding: 0; vertical-align: middle;">
                      <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body};"><strong>${escapeHtml(formattedOldDate)}</strong></p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" style="width: 100%; border-collapse: collapse; margin: ${EMAIL_STYLES.spacing.xs} 0 0 0;">
                  <tr>
                    <td style="width: 28px; padding: 0; vertical-align: middle;">
` + iconClock + `
                    </td>
                    <td style="padding: 0; vertical-align: middle;">
                      <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body};"><strong>${escapeHtml(oldBookingTime)} EST</strong></p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Arrow -->
              <div style="text-align: center; margin: ${EMAIL_STYLES.spacing.md} 0; color: ${EMAIL_STYLES.colors.primary};">
` + iconArrow + `
              </div>

              <!-- New Date/Time -->
              <div style="background-color: ${EMAIL_STYLES.colors.successBg}; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.success}; padding: ${EMAIL_STYLES.spacing.md}; margin: ${EMAIL_STYLES.spacing.lg} 0; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                <p style="margin: 0 0 ${EMAIL_STYLES.spacing.sm} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold}; text-transform: uppercase; letter-spacing: 0.5px;">New Appointment</p>
                <table role="presentation" style="width: 100%; border-collapse: collapse; margin: ${EMAIL_STYLES.spacing.xs} 0 0 0;">
                  <tr>
                    <td style="width: 28px; padding: 0; vertical-align: middle;">
` + iconCalendar + `
                    </td>
                    <td style="padding: 0; vertical-align: middle;">
                      <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body};"><strong>${escapeHtml(formattedNewDate)}</strong></p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" style="width: 100%; border-collapse: collapse; margin: ${EMAIL_STYLES.spacing.xs} 0 0 0;">
                  <tr>
                    <td style="width: 28px; padding: 0; vertical-align: middle;">
` + iconClock + `
                    </td>
                    <td style="padding: 0; vertical-align: middle;">
                      <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body};"><strong>${escapeHtml(newBookingTime)} EST</strong></p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Location -->
              <div style="background-color: ${EMAIL_STYLES.colors.cardBackground}; padding: ${EMAIL_STYLES.spacing.md}; margin: ${EMAIL_STYLES.spacing.lg} 0; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall}; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border};">
                <p style="margin: 0 0 ${EMAIL_STYLES.spacing.xs} 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">Location:</p>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="width: 28px; padding: 0; vertical-align: top; padding-top: 2px;">
` + iconLocation + `
                    </td>
                    <td style="padding: 0; vertical-align: top;">
                      <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body}; line-height: 1.5;">${escapeHtml(address)}</p>
                    </td>
                  </tr>
                </table>
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
            </td>
          </tr>

${generateEmailFooterWithSocial(address, styles)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
