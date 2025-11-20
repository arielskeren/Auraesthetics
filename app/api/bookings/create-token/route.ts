import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import Stripe from 'stripe';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_CLIENTS_LIST_ID =
  process.env.BREVO_CLIENTS_LIST_ID || process.env.BREVO_LIST_ID || '3';

// Generate a secure random token
function generateBookingToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = fullName.trim();
  if (!cleaned) {
    return { firstName: 'Guest', lastName: 'Client' };
  }
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Client' };
  }
  const [firstName, ...rest] = parts;
  return { firstName, lastName: rest.join(' ') || 'Client' };
}

function formatPhoneForBrevo(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 10 || digits.length > 15) return null;
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }
  if (phone.trim().startsWith('+')) {
    return phone.trim();
  }
  return `+${digits}`;
}

function normalizePhoneForPrefill(phone?: string | null): string | undefined {
  const formatted = formatPhoneForBrevo(phone);
  if (formatted) {
    return formatted;
  }
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length > 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return undefined;
}

async function upsertBrevoBookingContact(attendee: {
  name: string;
  email: string;
  phone?: string | null;
}) {
  if (!BREVO_API_KEY) {
    console.warn('[Brevo] BREVO_API_KEY not configured. Skipping contact sync.');
    return;
  }

  const listIdNumber = Number(BREVO_CLIENTS_LIST_ID);
  if (!Number.isFinite(listIdNumber) || listIdNumber <= 0) {
    console.warn('[Brevo] Invalid list ID. Set BREVO_CLIENTS_LIST_ID or BREVO_LIST_ID.');
    return;
  }

  if (!attendee.email) {
    console.warn('[Brevo] Missing attendee email. Skipping contact sync.');
    return;
  }

  const { firstName, lastName } = splitName(attendee.name || 'Guest Client');
  const formattedPhone = formatPhoneForBrevo(attendee.phone);

  const desiredBaseAttributes: Record<string, any> = {
    FIRSTNAME: firstName,
    LASTNAME: lastName,
  };

  if (formattedPhone) {
    desiredBaseAttributes.SMS = formattedPhone;
    desiredBaseAttributes.LANDLINE_NUMBER = formattedPhone;
  }

  let existingContact: any = null;
  try {
    const lookup = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(attendee.email)}`, {
      method: 'GET',
      headers: {
        'api-key': BREVO_API_KEY,
        Accept: 'application/json',
      },
    });

    if (lookup.ok) {
      existingContact = await lookup.json();
    } else if (lookup.status !== 404) {
      console.warn('[Brevo] Lookup failed', lookup.status);
    }
  } catch (lookupError) {
    console.warn('[Brevo] Lookup error', lookupError);
  }

  if (!existingContact) {
    const payload: Record<string, any> = {
      email: attendee.email,
      listIds: [listIdNumber],
      updateEnabled: true,
      attributes: {
        ...desiredBaseAttributes,
        SIGNUP_SOURCE: 'booking',
      },
    };

    try {
      const response = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        console.warn('[Brevo] Failed to create contact', {
          status: response.status,
          body: errorBody,
        });
      }
    } catch (createError) {
      console.warn('[Brevo] Contact creation error', createError);
    }
    return;
  }

  const existingAttributes = existingContact.attributes ?? {};
  const attributesToUpdate: Record<string, any> = {};

  Object.entries(desiredBaseAttributes).forEach(([key, value]) => {
    if (value && existingAttributes[key] !== value) {
      attributesToUpdate[key] = value;
    }
  });

  if (!existingAttributes.SIGNUP_SOURCE) {
    attributesToUpdate.SIGNUP_SOURCE = 'booking';
  }

  const existingListIds: number[] = Array.isArray(existingContact.listIds)
    ? existingContact.listIds
    : [];
  const listIdsChanged = !existingListIds.includes(listIdNumber);
  const updatePayload: Record<string, any> = {};

  if (Object.keys(attributesToUpdate).length > 0) {
    updatePayload.attributes = attributesToUpdate;
  }
  if (listIdsChanged) {
    updatePayload.listIds = Array.from(new Set([...existingListIds, listIdNumber]));
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  try {
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(attendee.email)}`, {
      method: 'PUT',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      console.warn('[Brevo] Failed to update contact', {
        status: response.status,
        body: errorBody,
      });
    }
  } catch (updateError) {
    console.warn('[Brevo] Contact update error', updateError);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      paymentIntentId,
      selectedSlot,
      reservation,
      attendee,
    } = body as {
      paymentIntentId?: string;
      selectedSlot?: {
        startTime?: string;
        eventTypeId?: number;
        timezone?: string;
        duration?: number | null;
        label?: string;
      } | null;
      reservation?: {
        id?: string;
        expiresAt?: string | null;
        startTime?: string | null;
        endTime?: string | null;
        timezone?: string | null;
      } | null;
      attendee?: {
        name?: string;
        email?: string;
        phone?: string;
        notes?: string;
      } | null;
    };

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      );
    }

    if (!selectedSlot || !selectedSlot.startTime || !selectedSlot.eventTypeId) {
      return NextResponse.json(
        { error: 'Selected availability slot is required' },
        { status: 400 }
      );
    }

    if (!attendee || !attendee.name || !attendee.email || !attendee.phone) {
      return NextResponse.json(
        { error: 'Attendee name, email, and phone are required' },
        { status: 400 }
      );
    }

    const attendeeDetails = {
      name: attendee.name.trim(),
      email: attendee.email.trim(),
      phone: attendee.phone.trim(),
      notes: attendee.notes ? attendee.notes.trim() : '',
    };

    if (!attendeeDetails.name || !attendeeDetails.email || !attendeeDetails.phone) {
      return NextResponse.json(
        { error: 'Attendee details cannot be empty' },
        { status: 400 }
      );
    }

    const { EST_TIMEZONE } = await import('@/lib/timezone');
    const slotDetails = {
      startTime: selectedSlot.startTime,
      eventTypeId: selectedSlot.eventTypeId,
      timezone: EST_TIMEZONE,
      duration: typeof selectedSlot.duration === 'number' ? selectedSlot.duration : null,
      label: selectedSlot.label || null,
    };

    const bookingDateIso = (() => {
      const date = new Date(slotDetails.startTime);
      return Number.isNaN(date.getTime()) ? slotDetails.startTime : date.toISOString();
    })();

    const reservationDetails =
      reservation && reservation.id
        ? {
            id: reservation.id,
            expiresAt: reservation.expiresAt ?? null,
            startTime: reservation.startTime ?? slotDetails.startTime,
            endTime: reservation.endTime ?? null,
            timezone: reservation.timezone ?? slotDetails.timezone,
          }
        : null;

    // Verify payment intent exists and is valid
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid payment intent' },
        { status: 400 }
      );
    }

    // Check if payment is successful or authorized
    const validStatuses = ['succeeded', 'requires_capture', 'processing'];
    if (!validStatuses.includes(paymentIntent.status)) {
      return NextResponse.json(
        { error: 'Payment not completed. Please complete payment first.' },
        { status: 400 }
      );
    }

    // Generate unique token
    const token = generateBookingToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    const sql = getSqlClient();

    // Store token in database
    // First, check if booking already exists for this payment intent
    const existingResult = await sql`
      SELECT id, metadata FROM bookings 
      WHERE payment_intent_id = ${paymentIntentId}
      LIMIT 1
    `;

    const paymentType = paymentIntent.metadata?.paymentType || 'full';
    const finalAmount = parseFloat(paymentIntent.metadata?.finalAmount || (paymentIntent.amount_received / 100).toString());
    const depositAmountMetadata = paymentIntent.metadata?.depositAmount
      ? parseFloat(paymentIntent.metadata.depositAmount)
      : paymentType === 'deposit'
        ? paymentIntent.amount / 100
        : finalAmount;
    const balanceDueMetadata = paymentIntent.metadata?.balanceDue
      ? parseFloat(paymentIntent.metadata.balanceDue)
      : Math.max(0, finalAmount - depositAmountMetadata);

    const metadataPaymentDetails = {
      paymentType,
      depositAmount: depositAmountMetadata,
      balanceDue: balanceDueMetadata,
      finalAmount,
      depositPercent: paymentIntent.metadata?.depositPercent || '50',
    };

    // Note: Cal.com public URL generation removed as part of Hapio migration
    // Booking verification now uses Hapio booking IDs instead
    const publicCalUrl = null;

    const existingRows = Array.isArray(existingResult)
      ? existingResult
      : (existingResult as any)?.rows ?? [];

    if (existingRows.length > 0) {
      const existingBooking = existingRows[0] as any;
      const existingMetadataRaw = existingBooking.metadata;
      const existingMetadata =
        existingMetadataRaw && typeof existingMetadataRaw === 'object'
          ? existingMetadataRaw
          : {};
      const stripeMetadata =
        existingMetadata?.stripe && typeof existingMetadata.stripe === 'object'
          ? existingMetadata.stripe
          : {};
      const updatedMetadata = {
        ...existingMetadata,
        bookingToken: token,
        tokenExpiresAt: expiresAt.toISOString(),
        paymentType,
        paymentDetails: metadataPaymentDetails,
        selectedSlot: slotDetails,
        attendee: attendeeDetails,
        reservation: reservationDetails ?? existingMetadata?.reservation ?? null,
        stripe: {
          ...stripeMetadata,
          lastSucceededIntentAt: new Date().toISOString(),
        },
        // Legacy Cal.com booking URL removed (Hapio migration)
      };

      // Update existing booking with token and payment status
      // Note: payment_type, amount, deposit_amount, final_amount, discount_code, discount_amount columns removed
      // Payment amounts are stored in payments table
      await sql`
        UPDATE bookings 
        SET 
          payment_status = ${paymentType === 'deposit' ? 'deposit_paid' : paymentIntent.status === 'succeeded' ? 'succeeded' : paymentIntent.status === 'requires_capture' ? 'authorized' : 'processing'},
          client_name = ${attendeeDetails.name || null},
          client_email = ${attendeeDetails.email || null},
          client_phone = ${attendeeDetails.phone || null},
          booking_date = ${bookingDateIso},
          metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
          updated_at = NOW()
        WHERE id = ${existingBooking.id}
      `;
    } else {
      // Create new booking record with token
      // Get service_id from metadata (Neon DB UUID) or fallback to service_slug
      const serviceIdFromMeta = paymentIntent.metadata?.service_id || paymentIntent.metadata?.service_slug || null;
      
      // Fetch service name from database if we have service_id
      let serviceName = 'Unknown Service';
      let serviceId = serviceIdFromMeta || 'unknown';
      
      if (serviceIdFromMeta) {
        try {
          const serviceRows = await sql`
            SELECT name, id, slug
            FROM services
            WHERE id = ${serviceIdFromMeta} OR slug = ${serviceIdFromMeta}
            LIMIT 1
          `;
          const svc = Array.isArray(serviceRows) ? serviceRows[0] : (serviceRows as any)?.rows?.[0];
          if (svc) {
            serviceName = svc.name || 'Unknown Service';
            serviceId = svc.id || serviceIdFromMeta; // Use Neon DB UUID if available
          }
        } catch (e) {
          // Fallback to slug if DB lookup fails
          serviceName = paymentIntent.metadata?.service_slug || 'Unknown Service';
        }
      }
      
      const amount = paymentIntent.amount / 100; // Amount charged (deposit or full)
      const discountCode = paymentIntent.metadata?.discountCode || null;
      const discountAmount = parseFloat(paymentIntent.metadata?.discountAmount || '0');
      const paymentStatus =
        paymentType === 'deposit'
          ? 'deposit_paid'
          : paymentIntent.status === 'succeeded'
          ? 'paid'
          : paymentIntent.status === 'requires_capture'
          ? 'authorized'
          : 'processing';

      // Store payment type in metadata
      const metadata = {
        bookingToken: token,
        tokenExpiresAt: expiresAt.toISOString(),
        paymentType,
        paymentDetails: metadataPaymentDetails,
        selectedSlot: slotDetails,
        attendee: attendeeDetails,
        reservation: reservationDetails,
        stripe: {
          lastSucceededIntentAt: new Date().toISOString(),
        },
        // Legacy Cal.com booking URL removed (Hapio migration)
      };

      // Insert booking (removed dropped columns: amount, deposit_amount, final_amount, discount_code, discount_amount, payment_type)
      // Payment amounts are stored in payments table
      await sql`
        INSERT INTO bookings (
          service_id,
          service_name,
          payment_status,
          payment_intent_id,
          client_name,
          client_email,
          client_phone,
          booking_date,
          metadata
        ) VALUES (
          ${serviceId},
          ${serviceName},
          ${paymentStatus},
          ${paymentIntentId},
          ${attendeeDetails.name || null},
          ${attendeeDetails.email || null},
          ${attendeeDetails.phone || null},
          ${bookingDateIso},
          ${JSON.stringify(metadata)}::jsonb
        )
      `;
    }

    await upsertBrevoBookingContact({
      name: attendeeDetails.name,
      email: attendeeDetails.email,
      phone: attendeeDetails.phone,
    });

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      paymentIntentId,
      paymentStatus: paymentIntent.status,
      publicBookingUrl: null, // Legacy Cal.com URL removed (Hapio migration)
    });
  } catch (error: any) {
    console.error('Token creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create booking token' },
      { status: 500 }
    );
  }
}

