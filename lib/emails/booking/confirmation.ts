/**
 * Booking confirmation email template
 * Compact design: Receipt on top, appointment details with image, side-by-side calendar buttons
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
  bookingTime: string;
  address?: string;
  bookingId?: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
  calendarLinks?: ReturnType<typeof generateCalendarLinks>;
  // Payment receipt details
  amountPaid?: number | null;
  transactionId?: string | null;
  paymentDate?: Date | null;
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
    amountPaid,
    transactionId,
    paymentDate,
  } = params;

  const styles = getEmailStyles();
  
  const finalCancelUrl = cancelUrl || (bookingId ? `${EMAIL_STYLES.urls.manageBooking}?id=${encodeURIComponent(bookingId)}` : EMAIL_STYLES.urls.manageBooking);
  const finalRescheduleUrl = rescheduleUrl || (bookingId ? `${EMAIL_STYLES.urls.manageBooking}?id=${encodeURIComponent(bookingId)}` : EMAIL_STYLES.urls.manageBooking);

  const shortDate = bookingDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const paymentDateFormatted = paymentDate?.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Generate calendar links with payment details
  const links = calendarLinks || (() => {
    const endDate = new Date(bookingDate);
    endDate.setHours(endDate.getHours() + 1);
    return generateCalendarLinks(serviceName, bookingDate, endDate, address, {
      amountPaid,
      transactionId,
      bookingId,
      clientName,
    });
  })();

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
${generateEmailHead('Booking Confirmation - Aura Aesthetics')}
</head>
<body style="${styles.body}">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.background};">
    <tr>
      <td align="center" style="padding: 16px 8px;">
        <table role="presentation" style="max-width: 520px; width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.white}; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${EMAIL_STYLES.colors.primary} 0%, #7A9A7E 100%); padding: 16px; text-align: center;">
              <h1 style="margin: 0; color: ${EMAIL_STYLES.colors.white}; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">Aura Aesthetics</h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 20px 16px 12px 16px; text-align: center;">
              <h2 style="margin: 0 0 6px 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: 18px; font-weight: 600;">Booking Confirmed!</h2>
              ${clientName ? `<p style="margin: 0; color: #666; font-size: 14px;">Thank you, ${escapeHtml(clientName)}</p>` : ''}
            </td>
          </tr>

          <!-- Payment Receipt (TOP) -->
          ${amountPaid ? `
          <tr>
            <td style="padding: 0 16px 16px 16px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fafaf8; border: 1px solid ${EMAIL_STYLES.colors.border}; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid ${EMAIL_STYLES.colors.border};">
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600;">Payment Receipt</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                      <tr>
                        <td style="color: #666; padding: 3px 0;">Amount</td>
                        <td style="color: ${EMAIL_STYLES.colors.primaryDark}; font-weight: 600; text-align: right; padding: 3px 0; font-size: 15px;">$${amountPaid.toFixed(2)}</td>
                      </tr>
                      ${paymentDateFormatted ? `
                      <tr>
                        <td style="color: #666; padding: 3px 0;">Date</td>
                        <td style="color: #444; text-align: right; padding: 3px 0;">${paymentDateFormatted}</td>
                      </tr>
                      ` : ''}
                      ${transactionId ? `
                      <tr>
                        <td style="color: #666; padding: 3px 0;">Ref</td>
                        <td style="color: ${EMAIL_STYLES.colors.primary}; text-align: right; padding: 3px 0; font-family: monospace; font-size: 11px;">${escapeHtml(transactionId)}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Appointment Details (Image Left, Info Right) -->
          <tr>
            <td style="padding: 0 16px 16px 16px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fafaf8; border: 1px solid ${EMAIL_STYLES.colors.border}; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid ${EMAIL_STYLES.colors.border};">
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600;">Appointment Details</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        ${serviceImageUrl ? `
                        <td style="width: 80px; vertical-align: top; padding-right: 12px;">
                          <img src="${escapeHtml(serviceImageUrl)}" alt="${escapeHtml(serviceName)}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; display: block;" />
                        </td>
                        ` : ''}
                        <td style="vertical-align: top;">
                          <p style="margin: 0 0 8px 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: 15px; font-weight: 600; line-height: 1.3;">${escapeHtml(serviceName)}</p>
                          <table role="presentation" style="border-collapse: collapse; font-size: 13px;">
                            <tr>
                              <td style="color: #888; padding: 2px 8px 2px 0;">📅</td>
                              <td style="color: #444; padding: 2px 0;">${shortDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #888; padding: 2px 8px 2px 0;">🕐</td>
                              <td style="color: #444; padding: 2px 0;">${bookingTime} EST</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Location -->
                <tr>
                  <td style="padding: 0 12px 12px 12px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.colors.white}; border: 1px solid ${EMAIL_STYLES.colors.border}; border-radius: 4px;">
                      <tr>
                        <td style="padding: 10px;">
                          <table role="presentation" style="border-collapse: collapse;">
                            <tr>
                              <td style="color: #888; padding-right: 8px; vertical-align: top;">📍</td>
                              <td>
                                <p style="margin: 0; color: #444; font-size: 13px; line-height: 1.4;">${escapeHtml(address)}</p>
                                <a href="${mapsUrl}" style="color: ${EMAIL_STYLES.colors.primary}; font-size: 12px; text-decoration: none;">Get Directions →</a>
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

          <!-- Calendar Buttons (Side by Side) -->
          <tr>
            <td style="padding: 0 16px 16px 16px;">
              <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-align: center;">Add to Calendar</p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 33.33%; padding: 0 3px 0 0;">
                    <a href="${links.google}" style="display: block; padding: 8px 4px; background-color: #4285F4; color: ${EMAIL_STYLES.colors.white}; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 600; text-align: center;">Google</a>
                  </td>
                  <td style="width: 33.33%; padding: 0 3px;">
                    <a href="${links.outlook}" style="display: block; padding: 8px 4px; background-color: #0078D4; color: ${EMAIL_STYLES.colors.white}; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 600; text-align: center;">Outlook</a>
                  </td>
                  <td style="width: 33.33%; padding: 0 0 0 3px;">
                    <a href="${links.ical}" download="aura-appointment.ics" style="display: block; padding: 8px 4px; background-color: #333; color: ${EMAIL_STYLES.colors.white}; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 600; text-align: center;">Apple</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Preparation Tips (Compact) -->
          <tr>
            <td style="padding: 0 16px 16px 16px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding-right: 6px; vertical-align: top;">
                    <div style="background-color: #f0f7f1; padding: 10px; border-radius: 6px; border-left: 3px solid ${EMAIL_STYLES.colors.primary};">
                      <p style="margin: 0 0 6px 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: 12px; font-weight: 600;">✓ Do</p>
                      <ul style="margin: 0; padding-left: 14px; color: #555; font-size: 11px; line-height: 1.5;">
                        <li>Arrive 10 min early</li>
                        <li>Clean, makeup-free skin</li>
                        <li>Stay hydrated</li>
                      </ul>
                    </div>
                  </td>
                  <td style="width: 50%; padding-left: 6px; vertical-align: top;">
                    <div style="background-color: #fff5f5; padding: 10px; border-radius: 6px; border-left: 3px solid ${EMAIL_STYLES.colors.error};">
                      <p style="margin: 0 0 6px 0; color: ${EMAIL_STYLES.colors.primaryDark}; font-size: 12px; font-weight: 600;">✗ Avoid</p>
                      <ul style="margin: 0; padding-left: 14px; color: #555; font-size: 11px; line-height: 1.5;">
                        <li>Sun 24hrs before</li>
                        <li>Retinol 3 days prior</li>
                        <li>Waxing 24hrs before</li>
                      </ul>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Buttons (Compact, Side by Side) -->
          <tr>
            <td style="padding: 0 16px 16px 16px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding-right: 4px;">
                    <a href="${finalRescheduleUrl}" style="display: block; padding: 10px 8px; background-color: ${EMAIL_STYLES.colors.white}; color: ${EMAIL_STYLES.colors.primary}; text-decoration: none; border: 1px solid ${EMAIL_STYLES.colors.primary}; border-radius: 4px; font-size: 12px; font-weight: 600; text-align: center;">Reschedule</a>
                  </td>
                  <td style="width: 50%; padding-left: 4px;">
                    <a href="${finalCancelUrl}" style="display: block; padding: 10px 8px; background-color: ${EMAIL_STYLES.colors.white}; color: ${EMAIL_STYLES.colors.error}; text-decoration: none; border: 1px solid ${EMAIL_STYLES.colors.error}; border-radius: 4px; font-size: 12px; font-weight: 600; text-align: center;">Cancel</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Booking Reference -->
          ${bookingId ? `
          <tr>
            <td style="padding: 0 16px 12px 16px; text-align: center;">
              <p style="margin: 0; color: #999; font-size: 11px;">Booking ID: <span style="font-family: monospace;">${escapeHtml(bookingId)}</span></p>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafaf8; padding: 14px 16px; text-align: center; border-top: 1px solid ${EMAIL_STYLES.colors.border};">
              <p style="margin: 0 0 4px 0; color: #666; font-size: 12px; font-weight: 600;">Aura Aesthetics</p>
              <p style="margin: 0 0 6px 0; color: #888; font-size: 11px; line-height: 1.4;">${escapeHtml(address)}</p>
              <a href="https://www.theauraesthetics.com" style="color: ${EMAIL_STYLES.colors.primary}; font-size: 11px; text-decoration: none;">www.theauraesthetics.com</a>
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
