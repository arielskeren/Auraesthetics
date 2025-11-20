/**
 * Generate reschedule email template
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
    address = '2998 Green Palm Court, Dania Beach, FL, 33312',
    bookingId,
    bookUrl,
    cancelUrl,
  } = params;

  // Generate URLs with booking ID if provided
  const baseUrl = 'https://www.theauraesthetics.com/manage-booking';
  const finalBookUrl = bookUrl || (bookingId ? `${baseUrl}?id=${encodeURIComponent(bookingId)}` : baseUrl);
  const finalCancelUrl = cancelUrl || (bookingId ? `${baseUrl}?id=${encodeURIComponent(bookingId)}` : baseUrl);

  const { EST_TIMEZONE } = await import('../timezone');
  const formattedOldDate = oldBookingDate.toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedNewDate = newBookingDate.toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const safeServiceName = escapeHtml(serviceName);
  const safeClientName = escapeHtml(clientName || 'Valued Client');
  const safeOldDate = escapeHtml(formattedOldDate);
  const safeOldTime = escapeHtml(oldBookingTime);
  const safeNewDate = escapeHtml(formattedNewDate);
  const safeNewTime = escapeHtml(newBookingTime);
  const safeAddress = escapeHtml(address);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Appointment Has Been Rescheduled</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f0;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f0;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); padding: 30px 20px; text-align: center;">
              ${serviceImageUrl ? `
                <img src="${escapeHtml(serviceImageUrl)}" alt="${safeServiceName}" style="max-width: 120px; height: auto; border-radius: 8px; margin-bottom: 15px; border: 2px solid rgba(255,255,255,0.3);" />
              ` : ''}
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Aura Wellness Aesthetics</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <h2 style="margin: 0 0 20px 0; color: #2d5016; font-size: 22px; font-weight: 600;">Your Appointment Has Been Rescheduled</h2>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi ${safeClientName},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Your appointment has been rescheduled. Please see the updated details below:
              </p>

              <!-- Service Info Box -->
              <div style="background-color: #f9f9f9; border-left: 4px solid #4a7c2a; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; color: #2d5016; font-size: 18px; font-weight: 600;">${safeServiceName}</h3>
              </div>

              <!-- Old Date/Time -->
              <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #856404; font-size: 14px; font-weight: 600; text-transform: uppercase;">Previous Appointment</p>
                <p style="margin: 0; color: #856404; font-size: 16px;">
                  <strong>${safeOldDate}</strong> at <strong>${safeOldTime} EST</strong>
                </p>
              </div>

              <!-- Arrow -->
              <div style="text-align: center; margin: 15px 0;">
                <span style="font-size: 24px; color: #4a7c2a;">↓</span>
              </div>

              <!-- New Date/Time -->
              <div style="background-color: #d4edda; border: 1px solid #4a7c2a; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #2d5016; font-size: 14px; font-weight: 600; text-transform: uppercase;">New Appointment</p>
                <p style="margin: 0; color: #2d5016; font-size: 16px;">
                  <strong>${safeNewDate}</strong> at <strong>${safeNewTime} EST</strong>
                </p>
              </div>

              <!-- Location -->
              <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px; border: 1px solid #e0e0e0;">
                <p style="margin: 0 0 5px 0; color: #666666; font-size: 14px; font-weight: 600;">Location:</p>
                <p style="margin: 0; color: #333333; font-size: 16px;">${safeAddress}</p>
              </div>

              <!-- Action Buttons -->
              <table role="presentation" style="width: 100%; margin: 30px 0; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${escapeHtml(finalBookUrl)}" style="display: inline-block; background-color: #4a7c2a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 5px;">View Booking Details</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 10px 0 0 0;">
                    <a href="${escapeHtml(finalCancelUrl)}" style="display: inline-block; color: #dc3545; text-decoration: none; font-size: 14px;">Need to cancel or reschedule?</a>
                  </td>
                </tr>
              </table>

              <!-- Booking ID -->
              ${bookingId ? `
              <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 30px;">
                <p style="margin: 0; color: #666666; font-size: 13px; line-height: 1.6; text-align: center;">
                  <strong>Booking ID:</strong> ${escapeHtml(bookingId)}
                </p>
              </div>
              ` : ''}

              <!-- Footer -->
              <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 30px;">
                <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                  We look forward to seeing you on <strong>${safeNewDate}</strong> at <strong>${safeNewTime} EST</strong>!
                </p>
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                  If you have any questions or need to make changes, please don't hesitate to reach out.
                </p>
                <p style="margin: 20px 0 0 0; color: #999999; font-size: 13px; line-height: 1.6; font-style: italic; text-align: center;">
                  Warm regards,<br>
                  <strong style="color: #2d5016;">Amy & The Aura Wellness Aesthetics Team</strong>
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

