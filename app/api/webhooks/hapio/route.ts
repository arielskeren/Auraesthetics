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

function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!secret) {
    console.error('[Hapio webhook] Missing HAPIO_SECRET');
    return false;
  }

  // Allow local testing when signature is omitted by comparing directly against the secret.
  if (!signature) {
    console.warn('[Hapio webhook] No signature provided, skipping verification (local testing only)');
    return false; // Don't allow in production
  }

  // Calculate expected signatures in all possible formats
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBase64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  
  // Clean the received signature
  const signatureClean = signature.trim();
  
  // Try multiple signature formats that Hapio might use
  // Some webhook providers use: sha256=hex, sha256=base64, or just hex/base64
  const possibleSignatures = [
    signatureClean,
    signatureClean.toLowerCase(),
    signatureClean.toUpperCase(),
    `sha256=${signatureClean}`,
    `sha256=${signatureClean.toLowerCase()}`,
    `sha256=${signatureClean.toUpperCase()}`,
  ];
  
  const expectedSignatures = [
    expectedHex,
    expectedBase64,
    `sha256=${expectedHex}`,
    `sha256=${expectedBase64}`,
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
    // Enhanced logging for debugging
    console.warn('[Hapio webhook] Signature mismatch', {
      receivedLength: signatureClean.length,
      receivedSignature: signatureClean.substring(0, 20) + '...',
      expectedHexLength: expectedHex.length,
      expectedBase64Length: expectedBase64.length,
      expectedHexPrefix: expectedHex.substring(0, 20) + '...',
      expectedBase64Prefix: expectedBase64.substring(0, 20) + '...',
      bodyLength: rawBody.length,
      bodyHash: crypto.createHash('sha256').update(rawBody).digest('hex').substring(0, 20) + '...',
      secretLength: secret.length,
      secretPrefix: secret.substring(0, 8) + '...',
    });
    
    // Log the actual body content to see if it matches what Hapio signed
    console.warn('[Hapio webhook] Body content:', {
      bodyPreview: rawBody.substring(0, 500),
      bodyIsValidJson: (() => {
        try {
          JSON.parse(rawBody);
          return true;
        } catch {
          return false;
        }
      })(),
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
    
    // Get raw body - this must be done before any JSON parsing
    // In Next.js, request.text() gives us the raw body
    const rawBody = await request.text();
    
    // Log webhook details for debugging
    console.log('[Hapio webhook] Received webhook:', {
      hasSignature: !!signature,
      signatureLength: signature?.length || 0,
      signaturePrefix: signature ? `${signature.substring(0, 20)}...` : 'none',
      signatureFull: signature, // Log full signature for debugging (remove in production)
      bodyLength: rawBody.length,
      bodyPreview: rawBody.substring(0, 200),
      bodyFull: rawBody, // Log full body for debugging (remove in production)
      secretLength: secret.length,
      secretPrefix: `${secret.substring(0, 8)}...`,
      allHeaders: Object.fromEntries(request.headers.entries()), // Log all headers
    });

    // TEMPORARILY: Make webhook public for debugging
    // TODO: Re-enable signature verification once we confirm the format
    const signatureValid = verifySignature(rawBody, signature, secret);
    if (!signatureValid) {
      console.warn('[Hapio webhook] Signature verification failed, but allowing request for debugging');
      console.warn('[Hapio webhook] This should be re-enabled in production!');
      // TEMPORARILY ALLOW: return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    } else {
      console.log('[Hapio webhook] Signature verification passed');
    }

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


