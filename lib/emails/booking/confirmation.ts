/**
 * Booking confirmation email template
 * Warm & Modern design with hero image left, details right layout
 */

import { getEmailStyles, EMAIL_STYLES } from '../_shared/styles';
import { escapeHtml, formatDateForEmail, generateEmailHead, generateEmailHeader, generateEmailFooterWithSocial } from '../_shared/utils';
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
  const detailsColumnWidth = serviceImageUrl ? '55%' : '100%';
  const dateTimeStyle = `margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.body}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};`;

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
${generateEmailHead('Booking Confirmation - The Aura Esthetics')}
</head>
<body style="${styles.body}">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.background}; padding: 0;">
    <tr>
      <td align="center" style="padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.sm};">
        <table role="presentation" style="${styles.container}">
          
${generateEmailHeader(styles)}

          <!-- Thank You Message -->
          <tr>
            <td style="padding: ${EMAIL_STYLES.spacing.xxl} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg}; text-align: center;">
              <h2 style="${styles.h2}">Thank You for Your Booking!</h2>
              ${clientName ? `<p style="margin: ${EMAIL_STYLES.spacing.sm} 0 ${EMAIL_STYLES.spacing.md} 0; ${styles.bodyText}">Dear ${escapeHtml(clientName)},</p>` : ''}
              <p style="margin: 0; ${styles.bodyText}">We're excited to welcome you to The Aura Esthetics. Your appointment has been confirmed!</p>
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
                    <img src="${escapeHtml(serviceImageUrl)}" alt="${escapeHtml(serviceName)}" style="width: 100%; height: auto; display: block; border-radius: ${EMAIL_STYLES.layout.borderRadius} 0 0 ${EMAIL_STYLES.layout.borderRadius};" />
                  </td>
                  ` : ''}
                  
                  <!-- Service Details Column (Right) -->
                  <td style="width: ${detailsColumnWidth}; padding: ${EMAIL_STYLES.spacing.xl}; vertical-align: top; background-color: ${EMAIL_STYLES.colors.cardBackground};">
                    <h3 style="margin: 0 0 ${EMAIL_STYLES.spacing.lg} 0; ${styles.h3}">${escapeHtml(serviceName)}</h3>
                    
                    <!-- Date -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: ${EMAIL_STYLES.spacing.md};">
                      <tr>
                        <td style="padding: ${EMAIL_STYLES.spacing.md}; background-color: ${EMAIL_STYLES.colors.white}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="width: 28px; padding: 0; vertical-align: middle; text-align: center;">
                                <span style="font-size: 18px;">•</span>
                              </td>
                              <td style="padding: 0; vertical-align: middle;">
                                <p style="${dateTimeStyle}">${escapeHtml(formattedDate)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Time -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: ${EMAIL_STYLES.spacing.md};">
                      <tr>
                        <td style="padding: ${EMAIL_STYLES.spacing.md}; background-color: ${EMAIL_STYLES.colors.white}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="width: 28px; padding: 0; vertical-align: middle; text-align: center;">
                                <span style="font-size: 18px;">•</span>
                              </td>
                              <td style="padding: 0; vertical-align: middle;">
                                <p style="${dateTimeStyle}">${escapeHtml(bookingTime)} EST</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Location -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: ${EMAIL_STYLES.spacing.md}; background-color: ${EMAIL_STYLES.colors.white}; border-radius: ${EMAIL_STYLES.layout.borderRadiusSmall};">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="width: 28px; padding: 0; vertical-align: top; padding-top: 2px; text-align: center;">
                                <span style="font-size: 18px;">•</span>
                              </td>
                              <td style="padding: 0; vertical-align: top;">
                                <p style="margin: 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.medium}; line-height: 1.5;">${escapeHtml(address)}</p>
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

          <!-- Add to Calendar Buttons -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.xl} ${EMAIL_STYLES.spacing.lg}; text-align: center;">
              <p style="margin: 0 0 ${EMAIL_STYLES.spacing.md} 0; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">Add to Calendar</p>
              <table role="presentation" style="width: 100%; border-collapse: collapse; max-width: 400px; margin: 0 auto;">
                <tr>
                  <td align="center" style="padding: ${EMAIL_STYLES.spacing.xs};">
                    <a href="${links.google}" style="${styles.button.calendar} background-color: #4285F4; margin: 0 auto;">Google Calendar</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: ${EMAIL_STYLES.spacing.xs};">
                    <a href="${links.outlook}" style="${styles.button.calendar} background-color: #0078D4; margin: 0 auto;">Outlook</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: ${EMAIL_STYLES.spacing.xs};">
                    <a href="${links.ical}" style="${styles.button.calendar} background-color: ${EMAIL_STYLES.colors.primaryDark}; margin: 0 auto;">iCal</a>
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
                      <h4 style="margin: 0 0 ${EMAIL_STYLES.spacing.sm} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.h4}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">✓ What to Do</h4>
                      <ul style="margin: 0; padding-left: ${EMAIL_STYLES.spacing.lg}; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; line-height: ${EMAIL_STYLES.typography.lineHeight.relaxed};">
                        <li style="margin-bottom: ${EMAIL_STYLES.spacing.xs};">Arrive 10 minutes early</li>
                        <li style="margin-bottom: ${EMAIL_STYLES.spacing.xs};">Come with clean, makeup-free skin</li>
                        <li style="margin-bottom: ${EMAIL_STYLES.spacing.xs};">Wear comfortable clothing</li>
                        <li style="margin-bottom: ${EMAIL_STYLES.spacing.xs};">Bring a list of current skincare products</li>
                        <li>Stay hydrated before your appointment</li>
                      </ul>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align: top;">
                    <div style="${styles.warningBox}">
                      <h4 style="margin: 0 0 ${EMAIL_STYLES.spacing.sm} 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: ${EMAIL_STYLES.typography.fontSize.h4}; font-weight: ${EMAIL_STYLES.typography.fontWeight.semibold};">✗ What to Avoid</h4>
                      <ul style="margin: 0; padding-left: ${EMAIL_STYLES.spacing.lg}; color: ${EMAIL_STYLES.colors.secondary}; font-size: ${EMAIL_STYLES.typography.fontSize.small}; line-height: ${EMAIL_STYLES.typography.lineHeight.relaxed};">
                        <li style="margin-bottom: ${EMAIL_STYLES.spacing.xs};">Avoid sun exposure 24 hours before</li>
                        <li style="margin-bottom: ${EMAIL_STYLES.spacing.xs};">Skip retinol products 3 days prior</li>
                        <li style="margin-bottom: ${EMAIL_STYLES.spacing.xs};">No waxing 24 hours before</li>
                        <li style="margin-bottom: ${EMAIL_STYLES.spacing.xs};">Avoid chemical peels 1 week prior</li>
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
              <table role="presentation" style="width: 100%; border-collapse: collapse; max-width: 300px; margin: 0 auto;">
                <tr>
                  <td align="center" style="padding: ${EMAIL_STYLES.spacing.xs};">
                    <a href="${finalRescheduleUrl}" style="${styles.button.secondary}">Reschedule</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: ${EMAIL_STYLES.spacing.xs};">
                    <a href="${finalCancelUrl}" style="${styles.button.danger}">Cancel</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Receipt Note -->
          <tr>
            <td style="padding: 0 ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg} ${EMAIL_STYLES.spacing.lg};">
              <p style="margin: 0; ${styles.xsmallText} font-style: italic; text-align: center; color: ${EMAIL_STYLES.colors.secondary};">
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

${generateEmailFooterWithSocial(address, styles)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
