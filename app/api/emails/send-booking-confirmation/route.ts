import { NextRequest, NextResponse } from 'next/server';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'hello@theauraesthetics.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://theauraesthetics.com';

interface BookingData {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  duration: string;
  paymentType: 'full' | 'deposit';
  amount: number;
  finalAmount: number;
  discountCode?: string;
  discountAmount?: number;
  location?: string;
  phone?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getPaymentTypeLabel(paymentType: string): string {
  switch (paymentType) {
    case 'full':
      return 'Paid in Full';
    case 'deposit':
      return '50% Deposit';
    default:
      return 'Paid';
  }
}

function createBookingConfirmationEmail(booking: BookingData): string {
  const paymentLabel = getPaymentTypeLabel(booking.paymentType);
  const location = booking.location || 'Fort Lauderdale, FL';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f0; line-height: 1.6; color: #2c2c2c;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f0; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7a8b7a 0%, #5a6b5a 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 400; font-family: 'Georgia', serif; letter-spacing: 1px;">
                Aura Wellness Aesthetics
              </h1>
              <p style="margin: 10px 0 0 0; color: #e8e8e8; font-size: 14px; font-style: italic;">
                Skin rituals, done gently.
              </p>
            </td>
          </tr>

          <!-- Confirmation Message -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; border-bottom: 2px solid #7a8b7a;">
              <h2 style="margin: 0 0 10px 0; color: #2c2c2c; font-size: 24px; font-weight: 600;">
                Thank You for Your Booking! ✨
              </h2>
              <p style="margin: 0; color: #666666; font-size: 16px;">
                We're excited to see you soon, ${booking.clientName.split(' ')[0]}!
              </p>
            </td>
          </tr>

          <!-- Booking Details -->
          <tr>
            <td style="padding: 30px;">
              <h3 style="margin: 0 0 20px 0; color: #2c2c2c; font-size: 20px; font-weight: 600; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
                Booking Details
              </h3>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <strong style="color: #5a6b5a;">Service:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">
                    <span style="color: #2c2c2c;">${booking.serviceName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <strong style="color: #5a6b5a;">Date:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">
                    <span style="color: #2c2c2c;">${formatDate(booking.bookingDate)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <strong style="color: #5a6b5a;">Time:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">
                    <span style="color: #2c2c2c;">${formatTime(booking.bookingTime)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <strong style="color: #5a6b5a;">Duration:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">
                    <span style="color: #2c2c2c;">${booking.duration}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <strong style="color: #5a6b5a;">Payment:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">
                    <span style="color: #2c2c2c;">${paymentLabel}</span>
                  </td>
                </tr>
                ${booking.discountCode ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                    <strong style="color: #5a6b5a;">Discount:</strong>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">
                    <span style="color: #2c2c2c;">${booking.discountCode} ($${booking.discountAmount?.toFixed(2) || '0.00'} off)</span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 12px 0;">
                    <strong style="color: #5a6b5a; font-size: 16px;">Total:</strong>
                  </td>
                  <td style="padding: 12px 0; text-align: right;">
                    <span style="color: #2c2c2c; font-size: 16px; font-weight: 600;">$${booking.finalAmount.toFixed(2)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Location Info -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #f9f9f7; border-left: 4px solid #7a8b7a; padding: 20px; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #5a6b5a; font-size: 16px; font-weight: 600;">
                  📍 Location
                </h4>
                <p style="margin: 0; color: #2c2c2c;">
                  ${location}
                </p>
                ${booking.phone ? `
                <p style="margin: 10px 0 0 0; color: #2c2c2c;">
                  <strong>Phone:</strong> ${booking.phone}
                </p>
                ` : ''}
              </div>
            </td>
          </tr>

          <!-- Important Tips -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="margin: 0 0 20px 0; color: #2c2c2c; font-size: 20px; font-weight: 600; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
                Pre-Appointment Tips
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #2c2c2c;">
                <li style="margin-bottom: 10px;">Please arrive 10 minutes early to complete any necessary forms</li>
                <li style="margin-bottom: 10px;">Avoid wearing makeup if possible for facial treatments</li>
                <li style="margin-bottom: 10px;">If you need to reschedule, please contact us at least 24 hours in advance</li>
                <li style="margin-bottom: 10px;">Come hydrated and relaxed - we're here to help you unwind</li>
                <li style="margin-bottom: 10px;">If you have any skin concerns or allergies, please let us know before your appointment</li>
              </ul>
            </td>
          </tr>

          <!-- To-Dos -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="margin: 0 0 20px 0; color: #2c2c2c; font-size: 20px; font-weight: 600; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">
                What to Bring
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #2c2c2c;">
                <li style="margin-bottom: 10px;">A valid ID</li>
                <li style="margin-bottom: 10px;">Any medical history forms (if not completed online)</li>
                <li style="margin-bottom: 10px;">A list of current medications or skincare products</li>
              </ul>
            </td>
          </tr>

          <!-- Payment Note -->
          ${booking.paymentType === 'deposit' ? `
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #fff8e1; border-left: 4px solid #f9a825; padding: 15px; border-radius: 4px;">
                <p style="margin: 0; color: #2c2c2c;">
                  <strong>Note:</strong> You've paid a 50% deposit. The remaining balance ($${(booking.finalAmount - booking.amount).toFixed(2)}) will be due at the time of your appointment.
                </p>
              </div>
            </td>
          </tr>
          ` : ''}
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f7; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px;">
                Questions? Contact us at <a href="mailto:${BREVO_FROM_EMAIL}" style="color: #7a8b7a; text-decoration: none;">${BREVO_FROM_EMAIL}</a>
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Aura Wellness Aesthetics. All rights reserved.
              </p>
              <p style="margin: 15px 0 0 0; color: #999999; font-size: 12px;">
                <a href="${SITE_URL}" style="color: #7a8b7a; text-decoration: none;">Visit our website</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    if (!BREVO_API_KEY) {
      console.error('BREVO_API_KEY not set');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      clientName,
      clientEmail,
      serviceName,
      bookingDate,
      bookingTime,
      duration,
      paymentType,
      amount,
      finalAmount,
      discountCode,
      discountAmount,
      location,
      phone,
    } = body;

    // Validate required fields
    if (!clientEmail || !serviceName || !bookingDate || !bookingTime) {
      return NextResponse.json(
        { error: 'Missing required fields: clientEmail, serviceName, bookingDate, bookingTime' },
        { status: 400 }
      );
    }

    const bookingData: BookingData = {
      clientName: clientName || 'Valued Client',
      clientEmail,
      serviceName,
      bookingDate,
      bookingTime,
      duration: duration || '1 hour',
      paymentType: paymentType || 'full',
      amount: amount || 0,
      finalAmount: finalAmount || amount || 0,
      discountCode,
      discountAmount,
      location,
      phone,
    };

    const htmlContent = createBookingConfirmationEmail(bookingData);

    // Send email via Brevo
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'Aura Wellness Aesthetics',
          email: BREVO_FROM_EMAIL,
        },
        to: [{ email: clientEmail, name: clientName }],
        subject: `Booking Confirmation - ${serviceName} on ${formatDate(bookingDate)}`,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send booking confirmation email:', errorText);
      return NextResponse.json(
        { error: 'Failed to send email', details: errorText },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Booking confirmation email sent',
      sentTo: clientEmail,
    });
  } catch (error: any) {
    console.error('Error sending booking confirmation email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

