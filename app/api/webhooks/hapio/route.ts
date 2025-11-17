import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSqlClient } from '@/app/_utils/db';

const HAPIO_SIGNATURE_HEADER = 'x-hapio-signature';

type SqlClient = ReturnType<typeof getSqlClient>;

function ensureObject<T extends Record<string, any>>(value: any): T {
  return value && typeof value === 'object' ? { ...(value as T) } : ({} as T);
}

function safeCompare(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function verifySignature(rawBody: string, signature: string | null, secret: string, timestamp: string | null = null) {
  if (!secret) {
    console.error('[Hapio webhook] Missing HAPIO_SECRET');
    return false;
  }

  // Require signature in production
  if (!signature) {
    console.error('[Hapio webhook] No signature provided');
    return false;
  }

  // Clean the received signature
  const signatureClean = signature.trim();
  
  // Hapio may sign with timestamp included: HMAC-SHA256(timestamp + body, secret)
  // Try both formats: body only, and timestamp + body
  const payloadsToTry = timestamp 
    ? [
        rawBody, // Standard: body only
        `${timestamp}.${rawBody}`, // Timestamp + body (common pattern)
        timestamp + rawBody, // Timestamp concatenated with body
      ]
    : [rawBody];
  
  // Calculate expected signatures in all possible formats
  const expectedSignatures: string[] = [];
  for (const payload of payloadsToTry) {
    const expectedHex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBase64 = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    expectedSignatures.push(expectedHex, expectedBase64);
  }
  
  // Try multiple signature formats that Hapio might use
  const possibleSignatures = [
    signatureClean,
    signatureClean.toLowerCase(),
    signatureClean.toUpperCase(),
  ];
  
  // Check all combinations
  let matches = false;
  for (const received of possibleSignatures) {
    for (const expected of expectedSignatures) {
      if (safeCompare(received, expected)) {
        matches = true;
        break;
      }
    }
    if (matches) break;
  }

  if (!matches) {
    // Log error (not warning) when signature fails
    console.error('[Hapio webhook] Signature verification failed', {
      receivedLength: signatureClean.length,
      receivedSignature: signatureClean.substring(0, 20) + '...',
      bodyLength: rawBody.length,
      timestamp: timestamp || 'none',
      secretLength: secret.length,
    });
  }

  return matches;
}

async function findBookingByHapioId(
  sql: SqlClient,
  hapioBookingId: string
) {
  const result = await sql`
    SELECT id, hapio_booking_id, payment_status, booking_date, metadata
    FROM bookings
    WHERE hapio_booking_id = ${hapioBookingId}
    LIMIT 1
  `;

  const rows = Array.isArray(result)
    ? result
    : (result as any)?.rows ?? [];

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as {
    id: string | number;
    hapio_booking_id: string | null;
    payment_status: string | null;
    booking_date: string | Date | null;
    metadata: any;
  };
}

interface HapioEvent {
  id?: string;
  type?: string;
  created_at?: string;
  data?: any;
  payload?: any;
}

interface HapioBookingPayload {
  id?: string;
  service_id?: string | null;
  location_id?: string | null;
  resource_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: string | null;
  is_temporary?: boolean | null;
  is_canceled?: boolean | null;
  metadata?: Record<string, unknown> | null;
  protected_metadata?: Record<string, unknown> | null;
}

function extractBookingId(payload: HapioBookingPayload | null | undefined) {
  if (!payload) {
    return null;
  }
  return payload.id ?? null;
}

function normalizeIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function determineHapioStatus(eventType: string | undefined, bookingPayload: HapioBookingPayload | null | undefined) {
  if (!eventType) {
    return bookingPayload?.status ?? null;
  }

  if (eventType.includes('canceled') || bookingPayload?.is_canceled) {
    return 'cancelled';
  }
  if (eventType.includes('confirmed')) {
    return 'confirmed';
  }
  if (eventType.includes('created')) {
    return 'created';
  }
  if (eventType.includes('updated')) {
    return bookingPayload?.status ?? 'updated';
  }
  return bookingPayload?.status ?? null;
}

async function updateBookingFromHapioEvent(
  sql: SqlClient,
  booking: Awaited<ReturnType<typeof findBookingByHapioId>>,
  event: HapioEvent,
  bookingPayload: HapioBookingPayload | null | undefined
) {
  if (!booking) {
    return;
  }

  const existingMetadata = ensureObject<Record<string, any>>(booking.metadata);
  const existingHapioMeta = ensureObject<Record<string, any>>(existingMetadata.hapio);

  const hapioStatus = determineHapioStatus(event.type, bookingPayload);
  const startsAtIso = normalizeIsoDate(bookingPayload?.starts_at ?? null);

  const updatedHapioMetadata = {
    ...existingHapioMeta,
    bookingId: bookingPayload?.id ?? booking.hapio_booking_id ?? existingHapioMeta.bookingId ?? null,
    status: hapioStatus ?? existingHapioMeta.status ?? null,
    lastEventAt: new Date().toISOString(),
    lastEventType: event.type ?? existingHapioMeta.lastEventType ?? null,
    lastPayload: bookingPayload ?? event.payload ?? event.data ?? null,
    confirmedAt:
      hapioStatus === 'confirmed'
        ? new Date().toISOString()
        : existingHapioMeta.confirmedAt ?? null,
    cancelledAt:
      hapioStatus === 'cancelled'
        ? new Date().toISOString()
        : existingHapioMeta.cancelledAt ?? null,
  };

  const updatedMetadata = {
    ...existingMetadata,
    hapio: updatedHapioMetadata,
  };

  const paymentStatusUpdate =
    hapioStatus === 'cancelled'
      ? 'cancelled'
      : booking.payment_status ?? null;

  const bookingDateValue =
    startsAtIso !== null
      ? new Date(startsAtIso)
      : booking.booking_date ?? null;

  await sql`
    UPDATE bookings
    SET
      booking_date = ${bookingDateValue},
      payment_status = ${paymentStatusUpdate},
      metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
      updated_at = NOW()
    WHERE id = ${booking.id}
  `;
}

// Test endpoint to verify webhook route is accessible
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Hapio webhook endpoint is accessible',
    path: '/api/webhooks/hapio',
    method: 'POST',
    headers: Object.fromEntries(request.headers.entries()),
  });
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.HAPIO_SECRET;
    if (!secret) {
      console.error('[Hapio webhook] Missing HAPIO_SECRET environment variable.');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // Get signature from header - check multiple possible header names
    const signature = 
      request.headers.get(HAPIO_SIGNATURE_HEADER) ||
      request.headers.get('x-hapio-signature') ||
      request.headers.get('X-Hapio-Signature') ||
      request.headers.get('hapio-signature');
    
    // Get timestamp from header (Hapio may include this in signature calculation)
    const timestamp = 
      request.headers.get('x-hapio-signature-timestamp') ||
      request.headers.get('X-Hapio-Signature-Timestamp') ||
      null;
    
    // Get raw body - this must be done before any JSON parsing
    // In Next.js, request.text() gives us the raw body
    const rawBody = await request.text();
    
    // Verify signature - RE-ENABLED for production security
    const signatureValid = verifySignature(rawBody, signature, secret, timestamp);
    if (!signatureValid) {
      console.error('[Hapio webhook] Signature verification failed - rejecting request');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    console.log('[Hapio webhook] Signature verification passed');

    let event: HapioEvent;
    try {
      event = JSON.parse(rawBody);
    } catch (error) {
      console.error('[Hapio webhook] Failed to parse JSON payload', error);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventType = event.type ?? '';

    // Respond to ping/test events without touching the database.
    if (!eventType || eventType.toLowerCase().includes('ping')) {
      return NextResponse.json({ ok: true, ping: true });
    }

    const bookingPayload: HapioBookingPayload | null | undefined =
      (event.data as HapioBookingPayload | undefined) ??
      (event.payload as HapioBookingPayload | undefined);

    const hapioBookingId = extractBookingId(bookingPayload);
    if (!hapioBookingId) {
      console.warn('[Hapio webhook] Booking payload missing id', event);
      return NextResponse.json({ ok: true, ignored: true });
    }

    const sql = getSqlClient();
    const booking = await findBookingByHapioId(sql, hapioBookingId);

    if (!booking) {
      console.warn('[Hapio webhook] No matching booking for Hapio booking id', hapioBookingId);
      return NextResponse.json({ ok: true, missing: true });
    }

    await updateBookingFromHapioEvent(sql, booking, event, bookingPayload);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Hapio webhook] Handler error', error);
    return NextResponse.json(
      { error: 'Hapio webhook handler failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';


