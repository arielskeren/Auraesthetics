import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

// Send email notifications for expired tokens
export async function POST(request: NextRequest) {
  try {
    const sql = getSqlClient();

    // Get expired bookings
    const expiredBookings = await sql`
      SELECT 
        id,
        service_name,
        client_email,
        client_name,
        amount,
        final_amount,
        payment_status,
        payment_intent_id,
        metadata->>'bookingToken' as booking_token,
        metadata->>'tokenExpiresAt' as token_expires_at,
        created_at
      FROM bookings
      WHERE 
        metadata->>'bookingToken' IS NOT NULL
        AND metadata->>'tokenExpiresAt' IS NOT NULL
        AND (metadata->>'tokenExpiresAt')::timestamp < NOW()
        AND cal_booking_id IS NULL
        AND payment_status IN ('paid', 'authorized', 'processing')
        AND (metadata->>'notificationSent')::boolean IS NOT TRUE
      ORDER BY created_at DESC
    `;

    if (expiredBookings.length === 0) {
      return NextResponse.json({
        message: 'No expired bookings to notify',
        notified: 0,
      });
    }

    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not set');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const notifications: any[] = [];

    // Send notification email to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@theauraesthetics.com';
    
    const emailBody = `
      <h2>Expired Booking Tokens Alert</h2>
      <p>You have ${expiredBookings.length} booking(s) where payment was received but the booking token expired before the appointment was scheduled.</p>
      
      <h3>Expired Bookings:</h3>
      <ul>
        ${expiredBookings.map((booking: any) => `
          <li>
            <strong>Service:</strong> ${booking.service_name}<br>
            <strong>Client:</strong> ${booking.client_email}${booking.client_name ? ` (${booking.client_name})` : ''}<br>
            <strong>Amount:</strong> $${booking.final_amount || booking.amount}<br>
            <strong>Payment Status:</strong> ${booking.payment_status}<br>
            <strong>Payment Intent:</strong> ${booking.payment_intent_id}<br>
            <strong>Expired At:</strong> ${new Date(booking.token_expires_at).toLocaleString()}<br>
            <strong>Action Needed:</strong> Contact client to reschedule or process refund
          </li>
        `).join('')}
      </ul>
      
      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Contact the client to reschedule their appointment</li>
        <li>If needed, regenerate booking token via admin dashboard</li>
        <li>If client cancels, process refund via Stripe</li>
      </ul>
      
      <p>View all bookings in your admin dashboard.</p>
    `;

    try {
      const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: 'Auraesthetics Booking System',
            email: process.env.BREVO_FROM_EMAIL || 'noreply@theauraesthetics.com',
          },
          to: [{ email: adminEmail }],
          subject: `⚠️ ${expiredBookings.length} Expired Booking Token(s) - Action Required`,
          htmlContent: emailBody,
        }),
      });

      if (emailResponse.ok) {
        // Mark notifications as sent
        for (const booking of expiredBookings) {
          await sql`
            UPDATE bookings
            SET 
              metadata = jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{notificationSent}',
                'true'::jsonb
              ),
              metadata = jsonb_set(
                metadata,
                '{notificationSentAt}',
                ${JSON.stringify(new Date().toISOString())}::jsonb
              ),
              updated_at = NOW()
            WHERE id = ${booking.id}
          `;
        }

        notifications.push({
          email: adminEmail,
          status: 'sent',
          bookingCount: expiredBookings.length,
        });
      } else {
        const errorText = await emailResponse.text();
        console.error('Failed to send notification email:', errorText);
        notifications.push({
          email: adminEmail,
          status: 'failed',
          error: errorText,
        });
      }
    } catch (error: any) {
      console.error('Error sending notification email:', error);
      notifications.push({
        email: adminEmail,
        status: 'error',
        error: error.message,
      });
    }

    return NextResponse.json({
      notified: notifications.filter((n) => n.status === 'sent').length,
      failed: notifications.filter((n) => n.status !== 'sent').length,
      notifications,
      expiredBookings: expiredBookings.map((b: any) => ({
        id: b.id,
        serviceName: b.service_name,
        clientEmail: b.client_email,
        amount: b.final_amount || b.amount,
        paymentStatus: b.payment_status,
      })),
    });
  } catch (error: any) {
    console.error('Error notifying expired tokens:', error);
    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}

