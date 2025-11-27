/**
 * Booking confirmation email template
 * Uses shared design system for consistent styling
 */

import { getEmailStyles, EMAIL_STYLES } from '../_shared/styles';
import { escapeHtml, formatDateForEmail, generateEmailHead, generateEmailHeader } from '../_shared/utils';
import { generateCalendarLinks } from '../_shared/calendar';

export { generateCalendarLinks };

export function generateBookingConfirmationEmail(params: {
  serviceName: string;
  serviceImageUrl?: string | null;
  clientName?: string | null;
  bookingDate: Date;
  bookingTime: string; // Formatted time string
  address?: string;
  bookingId?: string; // Internal booking ID or Hapio booking ID
  cancelUrl?: string;
  rescheduleUrl?: string;
  calendarLinks?: ReturnType<typeof generateCalendarLinks>;
}) {
  const {
    serviceName,
    serviceImageUrl,
    clientName,
    bookingDate,
    bookingTime,
    address = EMAIL_STYLES.defaultAddress,
    bookingId,
    cancelUrl,
    rescheduleUrl,
    calendarLinks,
  } = params;

  const styles = getEmailStyles();

  // Generate URLs with booking ID if provided
  const finalCancelUrl = cancelUrl || (bookingId ? `${EMAIL_STYLES.urls.manageBooking}?id=${encodeURIComponent(bookingId)}` : EMAIL_STYLES.urls.manageBooking);
  const finalRescheduleUrl = rescheduleUrl || (bookingId ? `${EMAIL_STYLES.urls.manageBooking}?id=${encodeURIComponent(bookingId)}` : EMAIL_STYLES.urls.manageBooking);

  const formattedDate = formatDateForEmail(bookingDate);

  // Generate calendar links if not provided
  const links = calendarLinks || (() => {
    const endDate = new Date(bookingDate);
    endDate.setHours(endDate.getHours() + 1); // Assume 1 hour default
    return generateCalendarLinks(serviceName, bookingDate, endDate, address);
  })();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
${generateEmailHead('Booking Confirmation - Aura Aesthetics')}
</head>
<body style="${styles.body}">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.background}; padding: 0;">
    <tr>
      <td align="center" style="padding: ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.sm};">
        <table role="presentation" style="${styles.container}">
          
${generateEmailHeader(styles)}

          <!-- Thank You Message -->
          <tr>
            <td style="padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg}; text-align: center;">
              <h2 style="${styles.h2}">Thank You for Your Booking!</h2>
              ${clientName ? `<p style="margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; ${styles.bodyText}">Dear ${escapeHtml(clientName)},</p>` : ''}
              <p style="margin: 0; ${styles.bodyText}">We're excited to welcome you to Aura Aesthetics. Your appointment has been confirmed!</p>
            </td>
          </tr>

          <!-- Service Details Card -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg};">
              <table role="presentation" style="width: 100%; border-collapse: collapse; ${styles.card}">
                <tr>
                  ${serviceImageUrl ? `
                  <td style="padding: ${EMAIL_STYLES.spacing.md}; text-align: center; background-color: ${EMAIL_STYLES.colors.white};">
                    <img src="${escapeHtml(serviceImageUrl)}" alt="${escapeHtml(serviceName)}" style="max-width: 200px; width: 100%; height: auto; border-radius: ${EMAIL_STYLES.layout.borderRadius}; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: block; margin: 0 auto;" />
                  </td>
                  ` : ''}
                </tr>
                <tr>
                  <td style="padding: ${serviceImageUrl ? `0 ${EMAIL_STYLES.spacing.md} ${EMAIL_STYLES.spacing.md} ${EMAIL_STYLES.spacing.md}` : EMAIL_STYLES.spacing.md}; text-align: center;">
                    <h3 style="${styles.h3}">${escapeHtml(serviceName)}</h3>
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
                      <tr>
                        <td style="padding: 12px; background-color: ${EMAIL_STYLES.colors.white}; border: ${EMAIL_STYLES.layout.borderWidth} solid ${EMAIL_STYLES.colors.border}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall}; text-align: center; margin-top: ${EMAIL_STYLES.spacing.sm};">
                          <p style="margin: 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.label}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">Location</p>
                          <p style="margin: 5px 0 0 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: 15px; font-weight: ${EMAIL_STYLES.typography.fontWeight.medium}; line-height: 1.4;">${escapeHtml(address)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Add to Calendar Buttons -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg}; text-align: center;">
              <p style="margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">Add to Calendar</p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${links.google}" style="${styles.button.calendar} background-color: #4285F4;">Google Calendar</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${links.outlook}" style="${styles.button.calendar} background-color: #0078D4;">Outlook</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${links.ical}" style="${styles.button.calendar} background-color: ${EMAIL_STYLES.colors.primary};">iCal</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- To-Dos and Don'ts -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg};">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding-bottom: ${EMAIL_STYLES.spacing.md}; vertical-align: top;">
                    <div style="${styles.infoBox}">
                      <h4 style="margin: 0 0 12px 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: 15px; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">✓ What to Do</h4>
                      <ul style="margin: 0; padding-left: ${EMAIL_STYLES.spacing.lg}; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; line-height: ${EMAIL_STYLES.typography.lineHeight.relaxed};">
                        <li style="margin-bottom: 5px;">Arrive 10 minutes early</li>
                        <li style="margin-bottom: 5px;">Come with clean, makeup-free skin</li>
                        <li style="margin-bottom: 5px;">Wear comfortable clothing</li>
                        <li style="margin-bottom: 5px;">Bring a list of current skincare products</li>
                        <li>Stay hydrated before your appointment</li>
                      </ul>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align: top;">
                    <div style="${styles.warningBox}">
                      <h4 style="margin: 0 0 12px 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: 15px; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">✗ What to Avoid</h4>
                      <ul style="margin: 0; padding-left: ${EMAIL_STYLES.spacing.lg}; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; line-height: ${EMAIL_STYLES.typography.lineHeight.relaxed};">
                        <li style="margin-bottom: 5px;">Avoid sun exposure 24 hours before</li>
                        <li style="margin-bottom: 5px;">Skip retinol products 3 days prior</li>
                        <li style="margin-bottom: 5px;">No waxing 24 hours before</li>
                        <li style="margin-bottom: 5px;">Avoid chemical peels 1 week prior</li>
                        <li>Don't use exfoliants the day before</li>
                      </ul>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Buttons -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg}; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${finalRescheduleUrl}" style="${styles.button.secondary}">Reschedule</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${finalCancelUrl}" style="${styles.button.danger}">Cancel</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Receipt Note -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg};">
              <p style="margin: 0; ${styles.xsmallText} font-style: italic; text-align: center;">
                <strong>Note:</strong> You will receive a separate payment receipt email from Stripe with your official receipt.
              </p>
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
                If you have any questions or need to make changes, please don't hesitate to contact us.
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

