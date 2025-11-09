'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { extractCalLink } from '@/app/_hooks/useCalEmbed';

declare global {
  interface Window {
    Cal?: any;
  }
}

const normalizePhoneForQuery = (phone?: string | null) => {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length > 10 && digits.length <= 15) {
    return phone.startsWith('+') ? phone : `+${digits}`;
  }
  if (phone.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return phone;
  }
  return undefined;
};

function VerifyBookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [bookingInfo, setBookingInfo] = useState<any>(null);
  const [slotInfo, setSlotInfo] = useState<{
    startTime?: string;
    label?: string;
    timezone?: string;
  } | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [contactPrefill, setContactPrefill] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
  }>({});
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const embedInitializedRef = useRef(false);
  const calUsername = process.env.NEXT_PUBLIC_CAL_USERNAME ?? '';
  const calEventSlug = process.env.NEXT_PUBLIC_CAL_EVENT_SLUG ?? '';
  const calLinkFromEnv = calUsername && calEventSlug ? `${calUsername}/${calEventSlug}` : null;

  useEffect(() => {
    const token = searchParams.get('token');
    const paymentIntentId = searchParams.get('paymentIntentId');
    const privateLinkUrl = searchParams.get('privateLink');
    const publicLinkUrl = searchParams.get('publicUrl');
    const calLinkParam = searchParams.get('calLink');
    const calLink = privateLinkUrl ? extractCalLink(privateLinkUrl) : calLinkParam;
    const selectedSlotParam = searchParams.get('selectedSlot');
    const contactParam = searchParams.get('contact');
    const reservationParam = searchParams.get('reservation');

    if (!token && !paymentIntentId) {
      setStatus('invalid');
      setError('Missing booking token or payment intent ID');
      return;
    }

    if (!calLink) {
      setStatus('invalid');
      setError('Missing Cal.com booking link');
      return;
    }

    let slotPayload: { startTime?: string; label?: string; timezone?: string } | null = null;
    if (selectedSlotParam) {
      try {
        slotPayload = JSON.parse(selectedSlotParam);
        setSlotInfo(slotPayload);
      } catch (parseError) {
        console.warn('Failed to parse selected slot payload:', parseError);
        slotPayload = null;
      }
    }

    if (contactParam) {
      try {
        const parsed = JSON.parse(contactParam);
        setContactPrefill({
          name: parsed?.name ?? parsed?.fullName ?? undefined,
          email: parsed?.email ?? undefined,
          phone: parsed?.phone ?? parsed?.smsReminderNumber ?? undefined,
          notes: parsed?.notes ?? undefined,
        });
      } catch (error) {
        console.warn('Failed to parse contact prefill payload:', error);
      }
    }

    let reservationPayload: {
      id?: string;
      startTime?: string | null;
      endTime?: string | null;
      timezone?: string | null;
    } | null = null;
    if (reservationParam) {
      try {
        reservationPayload = JSON.parse(reservationParam);
      } catch (error) {
        console.warn('Failed to parse reservation payload:', error);
        reservationPayload = null;
      }
    }

    // Verify token
    const verifyToken = async () => {
      try {
        const params = new URLSearchParams();
        if (token) params.append('token', token);
        if (paymentIntentId) params.append('paymentIntentId', paymentIntentId);

        const response = await fetch(`/api/bookings/verify-token?${params.toString()}`);
        const data = await response.json();

        if (data.valid) {
          setStatus('valid');
          setBookingInfo(data.booking);
          
          const resolvedLink = (() => {
            if (privateLinkUrl) {
              return privateLinkUrl;
            }
            if (publicLinkUrl) {
              return publicLinkUrl;
            }
            const calParams = new URLSearchParams({
              token: token || '',
              paymentIntentId: paymentIntentId || '',
              paymentType: searchParams.get('paymentType') || 'full',
            });
            if (slotPayload?.startTime) {
              calParams.append('slotStart', slotPayload.startTime);
            }
            if (slotPayload?.timezone) {
              calParams.append('timezone', slotPayload.timezone);
            }
            if (reservationPayload?.id) {
              calParams.append('reservationId', reservationPayload.id);
            }
            return `https://cal.com/${calLink}?${calParams.toString()}`;
          })();
          setFallbackUrl(resolvedLink);
        } else {
          setStatus('invalid');
          if (data.expired) {
            setError('Your booking token has expired. Please complete payment again.');
          } else if (data.isBooked) {
            setError('This booking has already been completed.');
          } else {
            setError('Invalid booking token. Please complete payment first.');
          }
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('invalid');
        setError('Failed to verify booking. Please try again.');
      }
    };

    verifyToken();

  }, [searchParams, router]);

  const embedName = contactPrefill.name || searchParams.get('name') || '';
  const embedEmail = contactPrefill.email || searchParams.get('email') || '';
  const embedPhone = contactPrefill.phone || searchParams.get('phone') || '';

  useEffect(() => {
    if (status !== 'valid' || !calLinkFromEnv) {
      return;
    }

    const initializeCal = () => {
      if (!window.Cal) {
        return;
      }
      const config: Record<string, any> = {};
      if (embedName) config.name = embedName;
      if (embedEmail) config.email = embedEmail;
      const formattedPhone = normalizePhoneForQuery(embedPhone);
      if (formattedPhone) {
        config.smsReminderNumber = formattedPhone;
      }
      if (contactPrefill.notes) {
        config.notes = contactPrefill.notes;
      }
      try {
        window.Cal('config', { forwardQueryParams: true });
      } catch (error) {
        // ignore config errors
      }
      window.Cal('inline', {
        elementOrSelector: '#cal-inline',
        calLink: calLinkFromEnv,
        config,
      });
      window.Cal('ui', { theme: 'light', hideEventTypeDetails: false });
      embedInitializedRef.current = true;
      if (scriptRef.current) {
        scriptRef.current = null;
      }
    };

    if (window.Cal) {
      initializeCal();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cal.com/embed.js';
    script.async = true;
    script.onload = initializeCal;
    document.head.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (!embedInitializedRef.current && scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
    };
  }, [status, calLinkFromEnv, embedName, embedEmail, embedPhone, contactPrefill.notes]);

  const backupLink = useMemo(() => {
    if (calLinkFromEnv) {
      const params = new URLSearchParams();
      if (embedName) params.set('name', embedName);
      if (embedEmail) params.set('email', embedEmail);
      const formattedPhone = normalizePhoneForQuery(embedPhone);
      if (formattedPhone) {
        params.set('smsReminderNumber', formattedPhone);
      }
      if (contactPrefill.notes) {
        params.set('notes', contactPrefill.notes);
      }
      if (slotInfo?.startTime) {
        const start = new Date(slotInfo.startTime);
        if (!Number.isNaN(start.getTime())) {
          params.set('date', start.toISOString().split('T')[0]);
          params.set(
            'time',
            start.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
          );
        }
      }
      if (slotInfo?.timezone) {
        params.set('timezone', slotInfo.timezone);
      }
      const query = params.toString();
      return `https://cal.com/${calLinkFromEnv}${query ? `?${query}` : ''}`;
    }
    return fallbackUrl;
  }, [calLinkFromEnv, embedName, embedEmail, embedPhone, contactPrefill.notes, slotInfo, fallbackUrl]);

  const reservedTimeLabel = useMemo(() => {
    if (!slotInfo?.startTime) return null;
    const start = new Date(slotInfo.startTime);
    if (Number.isNaN(start.getTime())) return null;
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: slotInfo.timezone || 'America/New_York',
    });
    return formatter.format(start);
  }, [slotInfo]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory p-4">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-8">
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-dark-sage animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-serif text-charcoal mb-2">Verifying Your Booking</h2>
            <p className="text-warm-gray">Please wait while we verify your payment...</p>
          </div>
        )}

        {status === 'valid' && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-serif text-charcoal mb-1">Payment verified!</h2>
                <p className="text-sm text-warm-gray">
                  We received your payment and placed a temporary hold on your chosen time. Confirm the slot below to finalize your booking.
                </p>
                {bookingInfo && (
                  <div className="mt-3 grid gap-1 text-sm text-warm-gray">
                    <p>
                      <span className="font-medium text-charcoal">Service:</span> {bookingInfo.serviceName}
                    </p>
                    <p>
                      <span className="font-medium text-charcoal">Payment:</span>{' '}
                      {bookingInfo.paymentType === 'full'
                        ? 'Paid in full'
                        : bookingInfo.paymentType === 'deposit'
                        ? '50% deposit'
                        : bookingInfo.paymentType}
                    </p>
                    {reservedTimeLabel && (
                      <p>
                        <span className="font-medium text-charcoal">Reserved time:</span> {reservedTimeLabel}
                        {slotInfo?.timezone ? ` (${slotInfo.timezone})` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong className="font-semibold">Next steps:</strong>{' '}
              Your time is held for a short window. Please re-select the same time in the scheduler below and click&nbsp;
              <em>Confirm</em> to finalize your appointment. If you picked a different time, your original hold will be released.
            </div>

            <div className="rounded-xl border border-sand bg-ivory/60 p-1">
              <div
                id="cal-inline"
                className="min-h-[660px] rounded-lg bg-white"
              >
                {!calLinkFromEnv && (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-warm-gray">
                    The Cal.com scheduler is unavailable right now. Use the backup link below or contact support to finish booking.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-sand pt-4 text-sm text-warm-gray sm:flex-row sm:items-center sm:justify-between">
              <span>
                Having trouble with the embed? Open Cal.com in a new tab and choose the same time to complete your booking.
              </span>
              {backupLink ? (
                <button
                  onClick={() => window.open(backupLink, '_blank', 'noopener')}
                  className="inline-flex items-center justify-center rounded-lg border border-dark-sage px-4 py-2 font-medium text-charcoal transition-colors hover:bg-dark-sage/90"
                >
                  Open scheduling in new tab (backup)
                </button>
              ) : (
                <span className="text-sm text-red-600">
                  We couldn&apos;t generate a scheduling link automatically. Please contact support so we can finalize your appointment.
                </span>
              )}
            </div>
          </div>
        )}

        {status === 'invalid' && (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-serif text-charcoal mb-2">Booking Not Verified</h2>
            <p className="text-warm-gray mb-4">{error}</p>
            <button
              onClick={() => router.push('/book')}
              className="px-6 py-2 bg-dark-sage text-charcoal rounded-lg font-medium hover:bg-sage-dark transition-colors"
            >
              Return to Booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <Loader2 className="w-12 h-12 text-dark-sage animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-serif text-charcoal mb-2">Verifying Your Booking</h2>
        <p className="text-warm-gray">Please wait while we verify your payment...</p>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function VerifyBookingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyBookingContent />
    </Suspense>
  );
}

