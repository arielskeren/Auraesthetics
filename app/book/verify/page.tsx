'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  useCalEmbed,
  openCalBooking,
  type CalPrefillOptions,
} from '@/app/_hooks/useCalEmbed';

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

  useCalEmbed();

  useEffect(() => {
    const token = searchParams.get('token');
    const paymentIntentId = searchParams.get('paymentIntentId');
    const calLink = searchParams.get('calLink');
    const selectedSlotParam = searchParams.get('selectedSlot');
    const contactParam = searchParams.get('contact');
    const reservationParam = searchParams.get('reservation');
    const metadataParam = searchParams.get('metadata');

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

    let contactPrefill: CalPrefillOptions | null = null;
    if (contactParam) {
      try {
        const parsed = JSON.parse(contactParam);
        contactPrefill = {
          name: parsed.name || '',
          email: parsed.email || '',
          smsReminderNumber: parsed.phone || '',
          notes: parsed.notes || '',
        };
      } catch (error) {
        console.warn('Failed to parse contact prefill payload:', error);
        contactPrefill = null;
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

    let metadataPayload: Record<string, any> | undefined;
    if (metadataParam) {
      try {
        metadataPayload = JSON.parse(metadataParam);
      } catch (error) {
        console.warn('Failed to parse metadata payload:', error);
      }
    }

    let fallbackTimer: number | undefined;

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

          const calUrl = `https://cal.com/${calLink}?${calParams.toString()}`;
          setFallbackUrl(calUrl);

          let slotForCal:
            | {
                startTime: string;
                endTime?: string | null;
                timezone?: string | null;
              }
            | undefined;

          if (reservationPayload?.startTime) {
            slotForCal = {
              startTime: reservationPayload.startTime,
              endTime: reservationPayload.endTime ?? undefined,
              timezone: reservationPayload.timezone ?? slotPayload?.timezone ?? undefined,
            };
          } else if (slotPayload?.startTime) {
            slotForCal = {
              startTime: slotPayload.startTime,
              endTime: undefined,
              timezone: slotPayload.timezone ?? undefined,
            };
          }

          const metadataForCal = {
            ...(metadataPayload || {}),
            token,
            paymentIntentId,
            reservationId: reservationPayload?.id,
          };

          openCalBooking({
            calLink,
            namespace: searchParams.get('serviceSlug') || undefined,
            slot: slotForCal,
            prefill: contactPrefill || undefined,
            metadata: metadataForCal,
            onClose: () => {
              if (fallbackTimer) {
                window.clearTimeout(fallbackTimer);
              }
              router.push('/book');
            },
          });

          fallbackTimer = window.setTimeout(() => {
            window.location.href = calUrl;
          }, 6000);
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

    return () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-dark-sage animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-serif text-charcoal mb-2">Verifying Your Booking</h2>
            <p className="text-warm-gray">Please wait while we verify your payment...</p>
          </>
        )}

        {status === 'valid' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-serif text-charcoal mb-2">Payment Verified!</h2>
            {bookingInfo && (
              <div className="text-sm text-warm-gray mb-4">
                <p>Service: {bookingInfo.serviceName}</p>
                <p>Payment Type: {
                  bookingInfo.paymentType === 'full' ? 'Paid in Full' :
                  bookingInfo.paymentType === 'deposit' ? '50% Deposit' :
                  bookingInfo.paymentType
                }</p>
                {slotInfo?.label && <p>Selected Slot: {slotInfo.label}</p>}
              </div>
            )}
            <p className="text-warm-gray mb-4">
              We opened the scheduling form in a popup. If it doesn&apos;t appear, use the button below.
            </p>
            {fallbackUrl && (
              <button
                onClick={() => window.open(fallbackUrl, '_blank', 'noopener')}
                className="px-6 py-2 bg-dark-sage text-charcoal rounded-lg font-medium hover:bg-sage-dark transition-colors"
              >
                Open Scheduling in New Tab
              </button>
            )}
          </>
        )}

        {status === 'invalid' && (
          <>
            <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-serif text-charcoal mb-2">Booking Not Verified</h2>
            <p className="text-warm-gray mb-4">{error}</p>
            <button
              onClick={() => router.push('/book')}
              className="px-6 py-2 bg-dark-sage text-charcoal rounded-lg font-medium hover:bg-sage-dark transition-colors"
            >
              Return to Booking
            </button>
          </>
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

