/**
 * Generate calendar links for booking confirmation emails
 */

import { EST_TIMEZONE } from '../timezone';

export function generateCalendarLinks(
  serviceName: string,
  startDate: Date,
  endDate: Date,
  address: string = '2998 Green Palm Court, Dania Beach, FL, 33312'
) {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);
  const title = encodeURIComponent(serviceName);
  const location = encodeURIComponent(address);
  const description = encodeURIComponent(`Appointment for ${serviceName} at Aura Aesthetics`);

  // Google Calendar
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${description}&location=${location}`;

  // Outlook Calendar
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${location}&body=${description}`;

  // iCal file (data URI)
  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aura Aesthetics//Booking Confirmation//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${serviceName}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${address}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  // For email, use data URI (works in most email clients)
  // Note: Some email clients may block data URIs, but this is the simplest approach
  const icalDataUri = `data:text/calendar;charset=utf8,${encodeURIComponent(icalContent)}`;

  return {
    google: googleUrl,
    outlook: outlookUrl,
    ical: icalDataUri,
    icalContent, // Raw content for potential server-side file hosting
  };
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate HTML email template for booking confirmation
 */
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
    address = '2998 Green Palm Court, Dania Beach, FL, 33312',
    bookingId,
    cancelUrl,
    rescheduleUrl,
    calendarLinks,
  } = params;

  // Generate URLs with booking ID if provided
  const baseUrl = 'https://www.theauraesthetics.com/manage-booking';
  const finalCancelUrl = cancelUrl || (bookingId ? `${baseUrl}?id=${encodeURIComponent(bookingId)}` : baseUrl);
  const finalRescheduleUrl = rescheduleUrl || (bookingId ? `${baseUrl}?id=${encodeURIComponent(bookingId)}` : baseUrl);

  const formattedDate = bookingDate.toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Booking Confirmation - Aura Aesthetics</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f0; padding: 0;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #6B8E6F 0%, #8B9A7A 100%); padding: 25px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: 1px;">Aura Aesthetics</h1>
            </td>
          </tr>

          <!-- Thank You Message -->
          <tr>
            <td style="padding: 30px 20px 20px 20px; text-align: center;">
              <h2 style="margin: 0 0 15px 0; color: #2C3E2D; font-size: 22px; font-weight: 600; line-height: 1.3;">Thank You for Your Booking!</h2>
              ${clientName ? `<p style="margin: 0 0 15px 0; color: #5A5A5A; font-size: 16px; line-height: 1.6;">Dear ${escapeHtml(clientName)},</p>` : ''}
              <p style="margin: 0; color: #5A5A5A; font-size: 16px; line-height: 1.6;">We're excited to welcome you to Aura Aesthetics. Your appointment has been confirmed!</p>
            </td>
          </tr>

          <!-- Service Details Card -->
          <tr>
            <td style="padding: 0 20px 25px 20px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F9F9F5; border-radius: 8px; overflow: hidden; border: 1px solid #E8E8E0;">
                <tr>
                  ${serviceImageUrl ? `
                  <td style="padding: 15px; text-align: center; background-color: #ffffff;">
                    <img src="${escapeHtml(serviceImageUrl)}" alt="${escapeHtml(serviceName)}" style="max-width: 200px; width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: block; margin: 0 auto;" />
                  </td>
                  ` : ''}
                </tr>
                <tr>
                  <td style="padding: ${serviceImageUrl ? '0 15px 15px 15px' : '15px'}; text-align: center;">
                    <h3 style="margin: 0 0 15px 0; color: #2C3E2D; font-size: 20px; font-weight: 600; line-height: 1.3;">${escapeHtml(serviceName)}</h3>
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                      <tr>
                        <td style="padding: 12px; background-color: #ffffff; border: 1px solid #E8E8E0; border-radius: 6px; text-align: center; margin-bottom: 10px;">
                          <p style="margin: 0; color: #5A5A5A; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Date</p>
                          <p style="margin: 5px 0 0 0; color: #2C3E2D; font-size: 16px; font-weight: 600;">${formattedDate}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px; background-color: #ffffff; border: 1px solid #E8E8E0; border-radius: 6px; text-align: center; margin-top: 10px;">
                          <p style="margin: 0; color: #5A5A5A; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Time</p>
                          <p style="margin: 5px 0 0 0; color: #2C3E2D; font-size: 16px; font-weight: 600;">${bookingTime} EST</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px; background-color: #ffffff; border: 1px solid #E8E8E0; border-radius: 6px; text-align: center; margin-top: 10px;">
                          <p style="margin: 0; color: #5A5A5A; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Location</p>
                          <p style="margin: 5px 0 0 0; color: #2C3E2D; font-size: 15px; font-weight: 500; line-height: 1.4;">${escapeHtml(address)}</p>
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
            <td style="padding: 0 20px 25px 20px; text-align: center;">
              <p style="margin: 0 0 15px 0; color: #5A5A5A; font-size: 14px; font-weight: 600;">Add to Calendar</p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${links.google}" style="display: inline-block; padding: 12px 20px; background-color: #4285F4; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; width: 100%; max-width: 200px; box-sizing: border-box;">Google Calendar</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${links.outlook}" style="display: inline-block; padding: 12px 20px; background-color: #0078D4; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; width: 100%; max-width: 200px; box-sizing: border-box;">Outlook</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${links.ical}" style="display: inline-block; padding: 12px 20px; background-color: #6B8E6F; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; width: 100%; max-width: 200px; box-sizing: border-box;">iCal</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- To-Dos and Don'ts -->
          <tr>
            <td style="padding: 0 20px 25px 20px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding-bottom: 15px; vertical-align: top;">
                    <div style="background-color: #F0F7F1; border-left: 4px solid #6B8E6F; padding: 15px; border-radius: 6px;">
                      <h4 style="margin: 0 0 12px 0; color: #2C3E2D; font-size: 15px; font-weight: 600;">✓ What to Do</h4>
                      <ul style="margin: 0; padding-left: 20px; color: #5A5A5A; font-size: 14px; line-height: 1.7;">
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
                    <div style="background-color: #FFF5F5; border-left: 4px solid #D97777; padding: 15px; border-radius: 6px;">
                      <h4 style="margin: 0 0 12px 0; color: #2C3E2D; font-size: 15px; font-weight: 600;">✗ What to Avoid</h4>
                      <ul style="margin: 0; padding-left: 20px; color: #5A5A5A; font-size: 14px; line-height: 1.7;">
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
            <td style="padding: 0 20px 25px 20px; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${finalRescheduleUrl}" style="display: inline-block; padding: 14px 24px; background-color: #ffffff; color: #6B8E6F; text-decoration: none; border: 2px solid #6B8E6F; border-radius: 6px; font-size: 14px; font-weight: 600; width: 100%; max-width: 250px; box-sizing: border-box;">Reschedule</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 5px;">
                    <a href="${finalCancelUrl}" style="display: inline-block; padding: 14px 24px; background-color: #ffffff; color: #D97777; text-decoration: none; border: 2px solid #D97777; border-radius: 6px; font-size: 14px; font-weight: 600; width: 100%; max-width: 250px; box-sizing: border-box;">Cancel</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Receipt Note -->
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <p style="margin: 0; color: #5A5A5A; font-size: 13px; line-height: 1.6; font-style: italic; text-align: center;">
                <strong>Note:</strong> You will receive a separate payment receipt email from Stripe with your official receipt.
              </p>
            </td>
          </tr>

          <!-- Booking ID -->
          ${bookingId ? `
          <tr>
            <td style="padding: 0 20px 20px 20px; border-top: 1px solid #E8E8E0;">
              <p style="margin: 0; color: #5A5A5A; font-size: 13px; line-height: 1.6; text-align: center;">
                <strong>Booking ID:</strong> ${escapeHtml(bookingId)}
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9F9F5; padding: 25px 20px; text-align: center; border-top: 1px solid #E8E8E0;">
              <p style="margin: 0 0 10px 0; color: #5A5A5A; font-size: 14px; line-height: 1.6;">
                If you have any questions or need to make changes, please don't hesitate to contact us.
              </p>
              <p style="margin: 0; color: #5A5A5A; font-size: 14px; line-height: 1.6;">
                <strong>Aura Aesthetics</strong><br />
                ${escapeHtml(address)}<br />
                <a href="https://www.theauraesthetics.com" style="color: #6B8E6F; text-decoration: none;">www.theauraesthetics.com</a>
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

