/**
 * Generate cancellation email template
 */

import { EST_TIMEZONE } from '../timezone';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateBookingCancellationEmail(params: {
  serviceName: string;
  serviceImageUrl?: string | null;
  clientName?: string | null;
  bookingDate: Date;
  bookingTime: string; // Formatted time string
  refundProcessed: boolean;
  refundAmount?: number | null; // in dollars
  refundId?: string | null;
  receiptUrl?: string | null; // Payment receipt URL
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
    address = '2998 Green Palm Court, Dania Beach, FL, 33312',
    bookingId,
    bookUrl = 'https://www.theauraesthetics.com/book',
  } = params;

  const formattedDate = bookingDate.toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const refundAmountFormatted = refundAmount != null ? `$${refundAmount.toFixed(2)}` : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Booking Cancellation - Aura Aesthetics</title>
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

          <!-- Cancellation Message -->
          <tr>
            <td style="padding: 30px 20px 20px 20px; text-align: center;">
              <h2 style="margin: 0 0 15px 0; color: #2C3E2D; font-size: 22px; font-weight: 600; line-height: 1.3;">Booking Cancelled</h2>
              ${clientName ? `<p style="margin: 0 0 15px 0; color: #5A5A5A; font-size: 16px; line-height: 1.6;">Dear ${escapeHtml(clientName)},</p>` : ''}
              <p style="margin: 0; color: #5A5A5A; font-size: 16px; line-height: 1.6;">We're sorry to see you go. Your appointment has been cancelled as requested.</p>
            </td>
          </tr>

          <!-- Cancelled Service Details Card -->
          <tr>
            <td style="padding: 0 20px 25px 20px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F9F9F5; border-radius: 8px; overflow: hidden; border: 1px solid #E8E8E0;">
                <tr>
                  ${serviceImageUrl ? `
                  <td style="padding: 15px; text-align: center; background-color: #ffffff;">
                    <img src="${escapeHtml(serviceImageUrl)}" alt="${escapeHtml(serviceName)}" style="max-width: 200px; width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: block; margin: 0 auto; opacity: 0.7;" />
                  </td>
                  ` : ''}
                </tr>
                <tr>
                  <td style="padding: ${serviceImageUrl ? '0 15px 15px 15px' : '15px'}; text-align: center;">
                    <h3 style="margin: 0 0 15px 0; color: #2C3E2D; font-size: 20px; font-weight: 600; line-height: 1.3;">${escapeHtml(serviceName)}</h3>
                    <p style="margin: 0 0 15px 0; color: #5A5A5A; font-size: 14px; line-height: 1.6;">Cancelled Appointment Details:</p>
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
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Refund Information -->
          ${refundProcessed ? `
          <tr>
            <td style="padding: 0 20px 25px 20px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F0F7F1; border-left: 4px solid #6B8E6F; border-radius: 6px; padding: 15px;">
                <tr>
                  <td>
                    <h4 style="margin: 0 0 12px 0; color: #2C3E2D; font-size: 16px; font-weight: 600;">✓ Refund Processed</h4>
                    <p style="margin: 0 0 8px 0; color: #5A5A5A; font-size: 14px; line-height: 1.6;">
                      <strong>Refund Amount:</strong> ${refundAmountFormatted || 'N/A'}
                    </p>
                    ${refundId ? `
                    <p style="margin: 0 0 8px 0; color: #5A5A5A; font-size: 14px; line-height: 1.6;">
                      <strong>Refund ID:</strong> ${escapeHtml(refundId)}
                    </p>
                    ` : ''}
                    ${refundReason ? `
                    <p style="margin: 0 0 8px 0; color: #5A5A5A; font-size: 14px; line-height: 1.6;">
                      <strong>Reason:</strong> ${escapeHtml(refundReason)}
                    </p>
                    ` : ''}
                    <p style="margin: 8px 0 0 0; color: #5A5A5A; font-size: 13px; line-height: 1.6;">
                      Your refund has been processed and should appear in your account within 5-10 business days, depending on your bank's processing time.
                    </p>
                    <p style="margin: 12px 0 0 0; color: #5A5A5A; font-size: 13px; line-height: 1.6; font-style: italic;">
                      <strong>Note:</strong> Your refund has been processed. Please allow 3-5 business days for it to appear on your statement.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : `
          <tr>
            <td style="padding: 0 20px 25px 20px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #FFF5F5; border-left: 4px solid #D97777; border-radius: 6px; padding: 15px;">
                <tr>
                  <td>
                    <h4 style="margin: 0 0 12px 0; color: #2C3E2D; font-size: 16px; font-weight: 600;">No Refund Issued</h4>
                    <p style="margin: 0; color: #5A5A5A; font-size: 14px; line-height: 1.6;">
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
            <td style="padding: 0 20px 25px 20px; text-align: center;">
              <a href="${bookUrl}" style="display: inline-block; padding: 14px 24px; background-color: #6B8E6F; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; width: 100%; max-width: 250px; box-sizing: border-box;">Book Another Appointment</a>
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
                We hope to see you again soon. If you have any questions, please don't hesitate to contact us.
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

