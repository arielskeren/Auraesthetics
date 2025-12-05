/**
 * Generate calendar links for booking confirmation emails
 */

import { EST_TIMEZONE } from '../timezone';

interface CalendarEventDetails {
  serviceName: string;
  startDate: Date;
  endDate: Date;
  address?: string;
  amountPaid?: number | null;
  transactionId?: string | null;
  bookingId?: string | null;
  clientName?: string | null;
}

export function generateCalendarLinks(
  serviceName: string,
  startDate: Date,
  endDate: Date,
  address: string = '2998 Green Palm Court, Dania Beach, FL 33312',
  details?: {
    amountPaid?: number | null;
    transactionId?: string | null;
    bookingId?: string | null;
    clientName?: string | null;
  }
) {
  const formatDateForICal = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const start = formatDateForICal(startDate);
  const end = formatDateForICal(endDate);
  
  // Build rich description with receipt info and useful links
  const descriptionLines = [
    `${serviceName} at Aura Aesthetics`,
    '',
    '📍 LOCATION',
    address,
    'https://maps.google.com/?q=' + encodeURIComponent(address),
    '',
  ];

  if (details?.amountPaid) {
    descriptionLines.push('💳 PAYMENT DETAILS');
    descriptionLines.push(`Amount Paid: $${details.amountPaid.toFixed(2)}`);
    if (details.transactionId) {
      descriptionLines.push(`Transaction Ref: ${details.transactionId}`);
    }
    if (details.bookingId) {
      descriptionLines.push(`Booking ID: ${details.bookingId}`);
    }
    descriptionLines.push('');
  }

  descriptionLines.push(
    '✨ PREPARATION TIPS',
    '• Arrive 10 minutes early',
    '• Come with clean, makeup-free skin',
    '• Stay hydrated',
    '',
    '🔗 QUICK LINKS',
    'Manage Booking: https://www.theauraesthetics.com/manage-booking' + (details?.bookingId ? `?id=${details.bookingId}` : ''),
    'Our Services: https://www.theauraesthetics.com/services',
    'Contact Us: https://www.theauraesthetics.com/contact',
    '',
    '—',
    'Aura Aesthetics',
    'www.theauraesthetics.com'
  );

  const description = descriptionLines.join('\n');
  const descriptionEncoded = encodeURIComponent(description);
  const title = encodeURIComponent(`${serviceName} - Aura Aesthetics`);
  const location = encodeURIComponent(address);

  // Google Calendar (supports reminders via URL params isn't reliable, but description works)
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${descriptionEncoded}&location=${location}`;

  // Outlook Calendar
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${location}&body=${descriptionEncoded}`;

  // Generate UID for iCal
  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@theauraesthetics.com`;
  
  // Calculate alarm times (in seconds before event)
  const twoHoursBefore = 2 * 60 * 60; // 7200 seconds
  const twentyFourHoursBefore = 24 * 60 * 60; // 86400 seconds

  // iCal file content with proper formatting and alarms
  // Note: \n in DESCRIPTION needs to be escaped as \\n for iCal format
  const icalDescription = description.replace(/\n/g, '\\n');
  
  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aura Aesthetics//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDateForICal(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${serviceName} - Aura Aesthetics`,
    `DESCRIPTION:${icalDescription}`,
    `LOCATION:${address}`,
    'STATUS:CONFIRMED',
    // Alarm 1: 24 hours before
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${serviceName} tomorrow at Aura Aesthetics`,
    'END:VALARM',
    // Alarm 2: 2 hours before
    'BEGIN:VALARM',
    `TRIGGER:-PT${twoHoursBefore}S`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${serviceName} in 2 hours at Aura Aesthetics`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  // Use base64 encoding for better email client compatibility
  const icalBase64 = Buffer.from(icalContent).toString('base64');
  const icalDataUri = `data:text/calendar;base64,${icalBase64}`;

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
  // Payment/Receipt details
  amountPaid?: number | null; // Amount in dollars
  transactionId?: string | null; // MagicPay transaction ID or Stripe PI
  paymentDate?: Date | null; // When payment was processed
}) {
  const {
    serviceName,
    serviceImageUrl,
    clientName,
    bookingDate,
    bookingTime,
    address = '2998 Green Palm Court, Dania Beach, FL 33312',
    bookingId,
    cancelUrl,
    rescheduleUrl,
    calendarLinks,
    amountPaid,
    transactionId,
    paymentDate,
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

  const shortDate = bookingDate.toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const paymentDateFormatted = paymentDate?.toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Generate calendar links with payment details
  const links = calendarLinks || (() => {
    const endDate = new Date(bookingDate);
    endDate.setHours(endDate.getHours() + 1); // Assume 1 hour default
    return generateCalendarLinks(serviceName, bookingDate, endDate, address, {
      amountPaid,
      transactionId,
      bookingId,
      clientName,
    });
  })();

  // Default image if none provided
  const imageUrl = serviceImageUrl || 'https://www.theauraesthetics.com/images/default-service.jpg';

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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f0; -webkit-font-smoothing: antialiased;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f0;">
    <tr>
      <td align="center" style="padding: 16px 8px;">
        <table role="presentation" style="max-width: 520px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6B8E6F 0%, #7A9A7E 100%); padding: 16px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">Aura Aesthetics</h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 20px 16px 12px 16px; text-align: center;">
              <h2 style="margin: 0 0 6px 0; color: #2C3E2D; font-size: 18px; font-weight: 600;">Booking Confirmed!</h2>
              ${clientName ? `<p style="margin: 0; color: #666; font-size: 14px;">Thank you, ${escapeHtml(clientName)}</p>` : ''}
            </td>
          </tr>

          <!-- Payment Receipt (TOP) -->
          ${amountPaid ? `
          <tr>
            <td style="padding: 0 16px 16px 16px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fafaf8; border: 1px solid #e8e8e0; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e8e8e0;">
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600;">Payment Receipt</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                      <tr>
                        <td style="color: #666; padding: 3px 0;">Amount</td>
                        <td style="color: #2C3E2D; font-weight: 600; text-align: right; padding: 3px 0; font-size: 15px;">$${amountPaid.toFixed(2)}</td>
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
                        <td style="color: #6B8E6F; text-align: right; padding: 3px 0; font-family: monospace; font-size: 11px;">${escapeHtml(transactionId)}</td>
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
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fafaf8; border: 1px solid #e8e8e0; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e8e8e0;">
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600;">Appointment Details</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <!-- Image Left -->
                        ${serviceImageUrl ? `
                        <td style="width: 80px; vertical-align: top; padding-right: 12px;">
                          <img src="${escapeHtml(serviceImageUrl)}" alt="${escapeHtml(serviceName)}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; display: block;" />
                        </td>
                        ` : ''}
                        <!-- Info Right -->
                        <td style="vertical-align: top;">
                          <p style="margin: 0 0 8px 0; color: #2C3E2D; font-size: 15px; font-weight: 600; line-height: 1.3;">${escapeHtml(serviceName)}</p>
                          <table role="presentation" style="border-collapse: collapse; font-size: 13px;">
                            <tr>
                              <td style="color: #888; padding: 2px 8px 2px 0; white-space: nowrap;">📅</td>
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
                    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff; border: 1px solid #e8e8e0; border-radius: 4px;">
                      <tr>
                        <td style="padding: 10px;">
                          <table role="presentation" style="border-collapse: collapse;">
                            <tr>
                              <td style="color: #888; padding-right: 8px; vertical-align: top;">📍</td>
                              <td>
                                <p style="margin: 0; color: #444; font-size: 13px; line-height: 1.4;">${escapeHtml(address)}</p>
                                <a href="https://maps.google.com/?q=${encodeURIComponent(address)}" style="color: #6B8E6F; font-size: 12px; text-decoration: none;">Get Directions →</a>
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
                    <a href="${links.google}" style="display: block; padding: 8px 4px; background-color: #4285F4; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 600; text-align: center;">Google</a>
                  </td>
                  <td style="width: 33.33%; padding: 0 3px;">
                    <a href="${links.outlook}" style="display: block; padding: 8px 4px; background-color: #0078D4; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 600; text-align: center;">Outlook</a>
                  </td>
                  <td style="width: 33.33%; padding: 0 0 0 3px;">
                    <a href="${links.ical}" download="aura-appointment.ics" style="display: block; padding: 8px 4px; background-color: #333; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 600; text-align: center;">Apple</a>
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
                    <div style="background-color: #f0f7f1; padding: 10px; border-radius: 6px; border-left: 3px solid #6B8E6F;">
                      <p style="margin: 0 0 6px 0; color: #2C3E2D; font-size: 12px; font-weight: 600;">✓ Do</p>
                      <ul style="margin: 0; padding-left: 14px; color: #555; font-size: 11px; line-height: 1.5;">
                        <li>Arrive 10 min early</li>
                        <li>Clean, makeup-free skin</li>
                        <li>Stay hydrated</li>
                      </ul>
                    </div>
                  </td>
                  <td style="width: 50%; padding-left: 6px; vertical-align: top;">
                    <div style="background-color: #fff5f5; padding: 10px; border-radius: 6px; border-left: 3px solid #D97777;">
                      <p style="margin: 0 0 6px 0; color: #2C3E2D; font-size: 12px; font-weight: 600;">✗ Avoid</p>
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

          <!-- Action Buttons (Compact) -->
          <tr>
            <td style="padding: 0 16px 16px 16px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding-right: 4px;">
                    <a href="${finalRescheduleUrl}" style="display: block; padding: 10px 8px; background-color: #fff; color: #6B8E6F; text-decoration: none; border: 1px solid #6B8E6F; border-radius: 4px; font-size: 12px; font-weight: 600; text-align: center;">Reschedule</a>
                  </td>
                  <td style="width: 50%; padding-left: 4px;">
                    <a href="${finalCancelUrl}" style="display: block; padding: 10px 8px; background-color: #fff; color: #D97777; text-decoration: none; border: 1px solid #D97777; border-radius: 4px; font-size: 12px; font-weight: 600; text-align: center;">Cancel</a>
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
            <td style="background-color: #fafaf8; padding: 14px 16px; text-align: center; border-top: 1px solid #e8e8e0;">
              <p style="margin: 0 0 4px 0; color: #666; font-size: 12px; font-weight: 600;">Aura Aesthetics</p>
              <p style="margin: 0 0 6px 0; color: #888; font-size: 11px; line-height: 1.4;">${escapeHtml(address)}</p>
              <a href="https://www.theauraesthetics.com" style="color: #6B8E6F; font-size: 11px; text-decoration: none;">www.theauraesthetics.com</a>
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
