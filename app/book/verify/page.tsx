'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Button from '@/app/_components/Button';

type SlotPayload = {
  startTime?: string;
  endTime?: string;
  timezone?: string;
};

type BookingSummary = {
  id: string;
  serviceName: string;
  serviceId: string;
  paymentType: string;
  paymentStatus: string;
  paymentIntentId: string | null;
  amount?: number | null;
  finalAmount?: number | null;
  expiresAt?: string | null;
};

type VerificationState = 'loading' | 'valid' | 'invalid';

function formatSlot(slot: SlotPayload | null) {
  if (!slot?.startTime || !slot?.endTime) {
    return null;
  }
  try {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    const tz = slot.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: tz,
    });
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    });
    return {
      date: dateFormatter.format(start),
      start: timeFormatter.format(start),
      end: timeFormatter.format(end),
      timezone: tz,
    };
  } catch {
    return null;
  }
}

function VerifyBookingInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [state, setState] = useState<VerificationState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [slotInfo, setSlotInfo] = useState<SlotPayload | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const paymentIntentId = searchParams.get('paymentIntentId');
    const selectedSlotParam = searchParams.get('selectedSlot');

    if (selectedSlotParam) {
      try {
        const parsed = JSON.parse(selectedSlotParam);
        setSlotInfo(parsed);
      } catch (err) {
        console.warn('Failed to parse slot payload', err);
      }
    }

    if (!token && !paymentIntentId) {
      setState('invalid');
      setError('Missing booking token or payment reference.');
      return;
    }

    const verify = async () => {
      setState('loading');
      setError(null);
      try {
        const params = new URLSearchParams();
        if (token) params.append('token', token);
        if (paymentIntentId) params.append('paymentIntentId', paymentIntentId);
        const response = await fetch(`/api/bookings/verify-token?${params.toString()}`);
        const body = await response.json();

        if (!response.ok || !body?.valid) {
          setState('invalid');
          if (body?.expired) {
            setError('This booking token has expired. Please start the booking process again.');
          } else if (body?.isBooked) {
            setError('This booking has already been completed.');
          } else {
            setError(body?.error || 'We could not verify this booking.');
          }
          return;
        }

        setBooking(body.booking as BookingSummary);
        setState('valid');
      } catch (err) {
        console.error('Booking verification failed', err);
        setError('We could not verify your booking right now. Please try again or contact support.');
        setState('invalid');
      }
    };

    verify();
  }, [searchParams]);

  const slotDisplay = useMemo(() => formatSlot(slotInfo), [slotInfo]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Loader2 className="w-12 h-12 text-dark-sage animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-serif text-charcoal mb-2">Verifying your booking</h2>
          <p className="text-warm-gray text-sm">Please wait while we finish confirming your appointment.</p>
        </div>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory p-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-600 mx-auto" />
          <h2 className="text-2xl font-serif text-charcoal">We couldn’t verify this booking</h2>
          <p className="text-sm text-warm-gray leading-relaxed">
            {error ||
              'Your payment is not linked to an active booking hold. Please return to the booking page or contact support for help.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => router.push('/book')}>Go back to booking</Button>
            <Button variant="secondary" onClick={() => router.push('/')}>
              Return home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory p-4">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-serif text-charcoal mb-1">You’re all set!</h1>
            <p className="text-sm text-warm-gray leading-relaxed">
              We received your payment and confirmed your appointment. An email with visit details is on its way to you.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-dark-sage/20 bg-dark-sage/10 p-4 space-y-3">
            <h2 className="font-semibold text-charcoal text-base">Appointment summary</h2>
            <div className="space-y-2 text-sm text-charcoal">
              {booking?.serviceName && (
                <div className="flex justify-between">
                  <span className="text-warm-gray">Service</span>
                  <span className="font-medium text-right">{booking.serviceName}</span>
                </div>
              )}
              {slotDisplay ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-warm-gray">Date</span>
                    <span className="font-medium text-right">{slotDisplay.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warm-gray">Time</span>
                    <span className="font-medium text-right">
                      {slotDisplay.start} – {slotDisplay.end} ({slotDisplay.timezone})
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-warm-gray">
                  Your reserved time will appear here once finalized in the booking flow.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-sand bg-ivory/80 p-4 space-y-3 text-sm text-charcoal">
            <h2 className="font-semibold text-charcoal text-base">Payment summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-warm-gray">Status</span>
                <span className="font-medium capitalize">{booking?.paymentStatus ?? 'pending'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-gray">Type</span>
                <span className="font-medium">
                  {booking?.paymentType === 'deposit' ? 'Deposit (50%)' : 'Paid in full'}
                </span>
              </div>
              {typeof booking?.finalAmount === 'number' && (
                <div className="flex justify-between">
                  <span className="text-warm-gray">Amount</span>
                  <span className="font-medium">${booking.finalAmount.toFixed(2)}</span>
                </div>
              )}
              {booking?.paymentIntentId && (
                <div className="text-xs text-warm-gray/80 break-all">
                  Stripe reference: <span className="font-mono">{booking.paymentIntentId}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-sand bg-white p-4 text-sm text-warm-gray space-y-2">
          <p>
            Need to make a change? Reply to your confirmation email or email{' '}
            <a className="underline text-charcoal" href="mailto:hello@aurawellnessaesthetics.com">
              hello@aurawellnessaesthetics.com
            </a>
            .
          </p>
          {booking?.expiresAt && (
            <p className="text-xs text-warm-gray/80">
              Original hold window: {new Date(booking.expiresAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => router.push('/')}>Back to home</Button>
          <Button variant="secondary" onClick={() => router.push('/book')}>
            Book another appointment
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <Loader2 className="w-12 h-12 text-dark-sage animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-serif text-charcoal mb-2">Verifying your booking</h2>
        <p className="text-warm-gray text-sm">Please wait…</p>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function VerifyBookingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyBookingInner />
    </Suspense>
  );
}


