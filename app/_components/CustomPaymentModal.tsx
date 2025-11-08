'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect, FormEvent, useCallback, useMemo, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { extractCalLink } from '../_hooks/useCalEmbed';
import Button from './Button';
import { getServicePhotoPaths } from '../_utils/servicePhotos';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CustomPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: {
    name: string;
    price: string;
    duration: string;
    category: string;
    slug?: string;
    calBookingUrl?: string | null;
  } | null;
}

type PaymentType = 'full' | 'deposit';

interface SlotSelectionPayload {
  startTime: string;
  eventTypeId: number;
  timezone: string;
  duration: number | null;
  label: string;
}

interface DiscountValidation {
  valid: boolean;
  discountAmount: number;
  finalAmount: number;
  originalAmount: number;
  code?: string;
}

interface ContactDetails {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface ReservationInfo {
  id: string;
  expiresAt: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
}

function deriveServiceSlug(service: { slug?: string; calBookingUrl?: string | null; name?: string } | null): string {
  if (!service) return '';
  if (service.slug) return service.slug;
  if (service.calBookingUrl) {
    try {
      const url = new URL(service.calBookingUrl);
      const segments = url.pathname.split('/').filter(Boolean);
      const slugFromUrl = segments.pop();
      if (slugFromUrl) {
        return slugFromUrl;
      }
    } catch {
      // ignore parsing errors and fall back to name
    }
  }
  if (service.name) {
    return service.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
  }
  return '';
}

interface AvailabilitySlot {
  slot: string;
  duration?: number | null;
  attendeeTimezone?: string | null;
}

interface AvailabilityData {
  slug: string;
  eventTypeId: number;
  title: string;
  requiresConfirmation: boolean;
  duration: number | null;
  availability: AvailabilitySlot[];
  meta: {
    fetchedAt: string;
    startTime: string;
    endTime: string;
    timezone: string;
    rateLimitRemaining: number | null;
    source: string;
  };
}

function formatDateHeading(date: Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
    ...options,
  }).format(date);
}

function formatTimeLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(date);
}

function AvailabilityPanel({
  serviceSlug,
  selectedSlot,
  onSelectSlot,
  hiddenSlotStart,
  isSelectionDisabled,
}: {
  serviceSlug: string;
  selectedSlot: SlotSelectionPayload | null;
  onSelectSlot: (slot: SlotSelectionPayload | null) => void;
  hiddenSlotStart?: string | null;
  isSelectionDisabled?: boolean;
}) {
  const [pageOffset, setPageOffset] = useState(0);
  const [daysPerPage, setDaysPerPage] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AvailabilityData | null>(null);
  const onSelectSlotRef = useRef(onSelectSlot);

  useEffect(() => {
    onSelectSlotRef.current = onSelectSlot;
  }, [onSelectSlot]);

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === 'undefined') return;
      const nextDays = window.innerWidth >= 1024 ? 7 : 3;
      setDaysPerPage((prev) => {
        if (prev !== nextDays) {
          setPageOffset(0);
        }
        return nextDays;
      });
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    setPageOffset(0);
  }, [serviceSlug]);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  if (pageOffset > 0) {
    startDate.setDate(startDate.getDate() + pageOffset * daysPerPage);
  }
  const startKey = startDate.toISOString();
  useEffect(() => {
    let isMounted = true;

    if (!serviceSlug) {
      setLoading(false);
      setData(null);
      setError(null);
      onSelectSlotRef.current(null);
      return () => {
        isMounted = false;
      };
    }

    async function fetchAvailability() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/cal/availability?slug=${serviceSlug}&start=${startKey}&days=${daysPerPage}`
        );
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error || 'Failed to load availability');
        }
        const payload = (await response.json()) as AvailabilityData;
        if (isMounted) {
          setData(payload);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load availability');
          setData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchAvailability();
    return () => {
      isMounted = false;
    };
  }, [serviceSlug, pageOffset, startKey, daysPerPage]);

  useEffect(() => {
    // Reset selection when service slug changes
    onSelectSlotRef.current(null);
  }, [serviceSlug]);

  const groupedSlots = (data?.availability || []).reduce(
    (acc, slot) => {
      const date = new Date(slot.slot);
      const dayKey = date.toISOString().split('T')[0];
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(slot);
      return acc;
    },
    {} as Record<string, AvailabilitySlot[]>
  );

  const orderedDays = Array.from({ length: daysPerPage }, (_, idx) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + idx);
    const dayUtc = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
    const key = dayUtc.toISOString().split('T')[0];
    return {
      key,
      date: day,
      slots: groupedSlots[key] || [],
    };
  });

  const handleSlotClick = (slot: AvailabilitySlot) => {
    if (!data) return;
    const startTime = slot.slot;
    const duration = slot.duration ?? data.duration ?? null;
    const timezone = 'America/New_York';
    const slotDate = new Date(startTime);
    const label = `${formatDateHeading(slotDate)} at ${formatTimeLabel(slotDate)}`;
    onSelectSlot({
      startTime,
      eventTypeId: data.eventTypeId,
      timezone,
      duration,
      label,
    });
  };

  const disablePrevious = pageOffset <= 0;
  const dayMs = 24 * 60 * 60 * 1000;

  return (
    <div className="mb-6 border border-sand rounded-lg">
      <div className="flex items-center justify-between px-4 py-2.5 bg-sand/30 border-b border-sand">
        <div className="flex items-center gap-2 text-charcoal">
          <CalendarDays size={18} />
          <div>
            <p className="text-sm font-medium">Availability</p>
            <p className="text-xs text-warm-gray">
              {formatDateHeading(startDate)} →{' '}
              {formatDateHeading(new Date(startDate.getTime() + (daysPerPage - 1) * dayMs))}
            </p>
            <p className="text-[11px] sm:text-xs text-warm-gray/90">All times Eastern (EST)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPageOffset((prev) => Math.max(0, prev - 1))}
            disabled={disablePrevious || loading}
            className="p-2 rounded-full border border-sage-dark text-sage-dark hover:bg-sand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={`Previous ${daysPerPage} days`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPageOffset((prev) => prev + 1)}
            disabled={loading}
            className="p-2 rounded-full border border-sage-dark text-sage-dark hover:bg-sand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={`Next ${daysPerPage} days`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="p-3 pb-2">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-warm-gray">
            <Loader2 className="animate-spin" size={16} />
            Loading available times...
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {!loading && serviceSlug && !error && orderedDays.length === 0 && (
          <p className="text-sm text-warm-gray">
            No openings this week. Try the next week or contact us directly.
          </p>
        )}

        {!loading && serviceSlug && !error && orderedDays.length > 0 && (
          <div className={daysPerPage === 7 ? 'overflow-x-auto lg:overflow-visible' : ''}>
            <div
              className={`grid gap-2.5 ${daysPerPage === 7 ? 'min-w-[900px] lg:min-w-0' : ''}`}
              style={{ gridTemplateColumns: `repeat(${daysPerPage}, minmax(0, 1fr))` }}
            >
              {orderedDays.map(({ key, date, slots }) => (
                <div key={key} className="border border-sand rounded-lg p-2.5 flex flex-col gap-2.5">
                  <p className="text-sm font-medium text-charcoal">
                    {formatDateHeading(date)}
                  </p>

                  {slots.length === 0 ? (
                    <div className="text-[11px] text-warm-gray italic">No availability</div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {slots.map((slot) => {
                        if (hiddenSlotStart && slot.slot === hiddenSlotStart) {
                          return null;
                        }
                        const slotDate = new Date(slot.slot);
                        const label = formatTimeLabel(slotDate);
                        const isSelected = selectedSlot?.startTime === slot.slot;
                        return (
                          <button
                            key={slot.slot}
                            type="button"
                            onClick={() => handleSlotClick(slot)}
                            disabled={isSelectionDisabled}
                            className={`block w-full px-2.5 py-1.5 rounded-md border text-[13px] sm:text-sm font-medium leading-tight text-center whitespace-nowrap transition-colors ${
                              isSelected
                                ? 'bg-dark-sage text-charcoal border-dark-sage'
                                : 'border-sage-dark text-sage-dark hover:bg-sand/30'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!serviceSlug && (
          <div className="text-sm text-warm-gray bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            Availability will appear once this service is linked to a Cal.com event type.
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentForm({ 
  service, 
  onSuccess, 
  onClose,
  modalStage,
  setModalStage,
}: { 
  service: NonNullable<CustomPaymentModalProps['service']>;
  onSuccess: (payload: {
    paymentIntentId: string;
    discountCode?: string;
    bookingToken: string;
    paymentType: PaymentType;
    slot: SlotSelectionPayload;
    contact: ContactDetails;
    reservation: ReservationInfo;
  }) => void;
  onClose: () => void;
  modalStage: 'availability' | 'details';
  setModalStage: (stage: 'availability' | 'details') => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [discountCode, setDiscountCode] = useState('');
  const [discountValidation, setDiscountValidation] = useState<DiscountValidation | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [depositAcknowledged, setDepositAcknowledged] = useState(false);
  const [contactDetails, setContactDetails] = useState<ContactDetails>({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [contactErrors, setContactErrors] = useState<Partial<Record<keyof ContactDetails, string>>>({});
  const [selectedSlot, setSelectedSlot] = useState<SlotSelectionPayload | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [preserveReservation, setPreserveReservation] = useState(false);
  const [reservationStatus, setReservationStatus] = useState<'idle' | 'holding' | 'held' | 'error'>('idle');
  const [reservationCountdown, setReservationCountdown] = useState(0);
  const [reservationAttempts, setReservationAttempts] = useState(0);
  const [reservationErrorDetail, setReservationErrorDetail] = useState<string | null>(null);
  const [reservationSuccessDetail, setReservationSuccessDetail] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const reserveRetryTimeoutRef = useRef<number | null>(null);

  const serviceSlug = deriveServiceSlug(service);
  const serviceIdentifier = serviceSlug || (service?.name ? service.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') : 'service');
  const shouldShowPaymentSections = modalStage === 'details' && reservationStatus === 'held' && !!reservation;
  const isAvailabilityStage = modalStage === 'availability';
  const reservationMatchesSelectedSlot = useMemo(() => {
    if (!reservation || !selectedSlot) return false;
    if (reservation.startTime && reservation.startTime === selectedSlot.startTime) {
      return true;
    }
    const reservationTimestamp = reservation.startTime ? Date.parse(reservation.startTime) : NaN;
    const selectedTimestamp = Date.parse(selectedSlot.startTime);
    if (!Number.isNaN(reservationTimestamp) && !Number.isNaN(selectedTimestamp)) {
      return reservationTimestamp === selectedTimestamp;
    }
    return false;
  }, [reservation, selectedSlot]);

  const isContactInfoComplete = useCallback(() => {
    return Boolean(
      contactDetails.name.trim() &&
      contactDetails.email.trim() &&
      contactDetails.phone.trim()
    );
  }, [contactDetails]);

  const validateContactDetails = useCallback(() => {
    const errors: Partial<Record<keyof ContactDetails, string>> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!contactDetails.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!contactDetails.email.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(contactDetails.email.trim())) {
      errors.email = 'Enter a valid email';
    }

    if (!contactDetails.phone.trim()) {
      errors.phone = 'Phone number is required';
    }

    setContactErrors(errors);
    return Object.keys(errors).length === 0;
  }, [contactDetails]);

  const contactInfoReady = isContactInfoComplete();

  const releaseReservation = useCallback(
    async (reservationId: string, options?: { preserveState?: boolean }) => {
      try {
        await fetch(`/api/cal/reservations/${reservationId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.warn('Failed to release reservation', error);
      } finally {
        if (!options?.preserveState) {
          setReservation(null);
          setSelectedSlot(null);
        }
      }
    },
    []
  );

  const clearPendingReserve = useCallback(() => {
    if (reserveRetryTimeoutRef.current) {
      window.clearTimeout(reserveRetryTimeoutRef.current);
      reserveRetryTimeoutRef.current = null;
    }
  }, []);

  const activeSlotKeyRef = useRef<string | null>(null);

  const performReserve = useCallback(
    async (slot: SlotSelectionPayload, attempt = 1) => {
      activeSlotKeyRef.current = slot.startTime;
      setReservationAttempts(attempt);
      setReservationStatus('holding');

      const start = slot.startTime;
      try {
        const response = await fetch('/api/cal/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventTypeId: slot.eventTypeId,
            slotStart: start,
            reservationDuration: 2,
            timeZone: slot.timezone,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const reserveMessage =
            errorBody?.message ||
            errorBody?.details?.message ||
            errorBody?.error ||
            'Failed to reserve slot';
          throw new Error(reserveMessage);
        }

        const body = await response.json();
        const reservationPayload = body.reservation ?? body.data ?? body;

        const newReservation: ReservationInfo = {
          id: reservationPayload.id,
          expiresAt: reservationPayload.expiresAt ?? null,
          startTime: reservationPayload.startTime ?? start,
          endTime: reservationPayload.endTime ?? null,
          timezone: reservationPayload.timezone ?? slot.timezone,
        };

        if (!newReservation.id) {
          throw new Error('Failed to reserve slot: missing reservation ID');
        }

        if (activeSlotKeyRef.current !== slot.startTime) {
          return;
        }

        clearPendingReserve();
        if (reservation && reservation.id && reservation.id !== newReservation.id) {
          void releaseReservation(reservation.id, { preserveState: true });
        }

        let verified = true;
        try {
          const verifyResponse = await fetch(`/api/cal/reservations/${newReservation.id}/verify`);
          if (!verifyResponse.ok) {
            verified = false;
          } else {
            const verifyJson = await verifyResponse.json();
            const verifyStatus = verifyJson.status ?? (verifyJson.success === false ? 'error' : 'success');
            if (verifyStatus !== 'success') {
              verified = false;
            }
          }
        } catch (verifyError) {
          console.warn('Reservation verification failed', verifyError);
          verified = false;
        }

        if (!verified) {
          await releaseReservation(newReservation.id, { preserveState: true });
          clearPendingReserve();
          setReservationLoading(false);
          setReservationStatus('error');
          setReservationErrorDetail('We could not confirm the hold. Please select another time.');
          setReservation(null);
          setSelectedSlot(null);
          setReservationCountdown(0);
          setReservationAttempts(0);
          setReservationSuccessDetail(null);
          setCardComplete(false);
          activeSlotKeyRef.current = null;
          return;
        }

        const expiresAt = newReservation.expiresAt ? new Date(newReservation.expiresAt).getTime() : null;
        const countdownSeconds =
          expiresAt && Number.isFinite(expiresAt)
            ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
            : 120;

        setReservation({
          ...newReservation,
          startTime: newReservation.startTime ?? start,
          endTime: newReservation.endTime ?? null,
          timezone: newReservation.timezone ?? slot.timezone ?? null,
        });
        setModalStage('details');
        setReservationStatus('held');
        setReservationCountdown(countdownSeconds > 0 ? countdownSeconds : 120);
        setReservationLoading(false);
        setReservationErrorDetail(null);
        setPreserveReservation(false);
        const expiresDisplay =
          newReservation.expiresAt
            ? new Date(newReservation.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : null;
        setReservationSuccessDetail(
          expiresDisplay
            ? `Slot reserved. Complete checkout by ${expiresDisplay}.`
            : 'Slot reserved. Complete checkout below.'
        );
        console.log('Reservation confirmed', {
          reservationId: newReservation.id,
          slot: newReservation.startTime,
          expiresAt: newReservation.expiresAt,
        });
      } catch (error: any) {
        if (activeSlotKeyRef.current !== slot.startTime) {
          return;
        }

        console.error('Failed to reserve slot:', error);
        const message = error?.message || 'Unable to reserve this time. Please try again.';

        if (attempt < 3) {
          setReservationErrorDetail(`${message} Retrying (${attempt + 1}/3)...`);
          reserveRetryTimeoutRef.current = window.setTimeout(() => {
            performReserve(slot, attempt + 1);
          }, 1500 * attempt);
        } else {
          clearPendingReserve();
          setReservationLoading(false);
          setReservationStatus('error');
          setReservationErrorDetail(message);
          setReservationSuccessDetail(null);
          activeSlotKeyRef.current = null;
          setReservation(null);
          setSelectedSlot(null);
        }
      }
    },
    [clearPendingReserve, reservation, releaseReservation]
  );

  const reserveSlot = useCallback(
    async (slot: SlotSelectionPayload) => {
      clearPendingReserve();
      setReservationLoading(true);
      setReservationErrorDetail(null);
      setReservationAttempts(0);
      setReservationStatus('holding');
      await performReserve(slot, 1);
    },
    [clearPendingReserve, performReserve]
  );

  const resetReservationState = useCallback(
    (
      message?: string,
      options?: {
        resetContact?: boolean;
        resetPayment?: boolean;
      }
    ) => {
    activeSlotKeyRef.current = null;
    setReservation(null);
    setSelectedSlot(null);
    setReservationStatus('idle');
    setReservationCountdown(0);
    setReservationAttempts(0);
    setReservationErrorDetail(null);
    setReservationSuccessDetail(message ?? null);
    setReservationLoading(false);
    setCardComplete(false);
    setPreserveReservation(false);
    setModalStage('availability');
    if (options?.resetContact) {
      setContactDetails({
        name: '',
        email: '',
        phone: '',
        notes: '',
      });
      setContactErrors({});
    }
    if (options?.resetPayment) {
      setDiscountCode('');
      setDiscountValidation(null);
      setPaymentType('full');
      setDepositAcknowledged(false);
    }
  },
  [
    setContactDetails,
    setContactErrors,
    setDiscountCode,
    setDiscountValidation,
    setPaymentType,
    setDepositAcknowledged,
    setModalStage,
  ]);

  const previousServiceSlugRef = useRef(serviceSlug);

  useEffect(() => {
    if (previousServiceSlugRef.current === serviceSlug) {
      return;
    }
    previousServiceSlugRef.current = serviceSlug;
    resetReservationState(undefined, { resetContact: true, resetPayment: true });
  }, [serviceSlug, resetReservationState]);

  const handleReleaseSlot = useCallback(async (message?: string) => {
    if (!reservation?.id) {
      resetReservationState(message, { resetContact: true, resetPayment: true });
      return;
    }
    setReservationLoading(true);
    setPreserveReservation(true);
    try {
      await releaseReservation(reservation.id, { preserveState: true });
      resetReservationState(message ?? 'Slot released. Select a new time to continue.', {
        resetContact: true,
        resetPayment: true,
      });
    } catch (error) {
      console.warn('Release slot failed', error);
      resetReservationState();
      setReservationErrorDetail('We could not release the slot automatically. Please pick a new time.');
    }
  }, [releaseReservation, reservation, resetReservationState]);

  const handleChangeTime = useCallback(async () => {
    await handleReleaseSlot('Slot released. Select a new time to continue.');
  }, [handleReleaseSlot]);

  const handleCancel = useCallback(() => {
    if (reservation?.id) {
      void handleReleaseSlot('Slot released.');
    }
    onClose();
  }, [handleReleaseSlot, onClose, reservation]);

  const handleSlotSelection = useCallback(
    (slot: SlotSelectionPayload | null) => {
      clearPendingReserve();

      if (!slot) {
        setSelectedSlot(null);
        setSlotError(null);
        setReservationStatus('idle');
        setReservationCountdown(0);
        setReservationErrorDetail(null);
        setReservationAttempts(0);
        setReservationLoading(false);
        setPreserveReservation(false);
        if (reservation?.id) {
          void releaseReservation(reservation.id);
        }
        return;
      }

      setSelectedSlot(slot);
      setSlotError(null);
      setReservationErrorDetail(null);

      const isSameReservedSlot =
        reservationStatus === 'held' &&
        reservation &&
        reservation.startTime === slot.startTime;

      if (isSameReservedSlot) {
        setModalStage('details');
        return;
      }

      if (reservationLoading && activeSlotKeyRef.current === slot.startTime) {
        return;
      }

      setPreserveReservation(false);
      setModalStage('availability');
      reserveSlot(slot);
    },
    [
      clearPendingReserve,
      releaseReservation,
      reservation,
      reservationLoading,
      reservationStatus,
      reserveSlot,
      setModalStage,
    ]
  );

  // Extract numeric price from string (e.g., "from $150" -> 150)
  const extractPrice = (priceString: string): number => {
    const match = priceString.match(/\$?(\d+)/);
    return match ? parseFloat(match[1]) : 0;
  };

  const baseAmount = extractPrice(service.price);
  const [currentAmount, setCurrentAmount] = useState(baseAmount);
  const currentFinalAmount = discountValidation?.finalAmount || baseAmount;
  const balanceDue =
    paymentType === 'deposit'
      ? Number(Math.max(0, currentFinalAmount - currentAmount).toFixed(2))
      : 0;

  // Update amount when discount or payment type changes
  useEffect(() => {
    let amount = discountValidation?.finalAmount || baseAmount;
    
    if (paymentType === 'deposit') {
      amount = amount * 0.5; // 50% deposit
    }
    
    setCurrentAmount(amount);
  }, [paymentType, discountValidation, baseAmount]);

  useEffect(() => {
    if (reservationStatus === 'error' && reservationErrorDetail) {
      const timer = window.setTimeout(() => {
        setReservationErrorDetail(null);
      }, 5000);
      return () => window.clearTimeout(timer);
    }
  }, [reservationStatus, reservationErrorDetail]);

  useEffect(() => {
    if (reservationSuccessDetail) {
      const timer = window.setTimeout(() => {
        setReservationSuccessDetail(null);
      }, 4000);
      return () => window.clearTimeout(timer);
    }
  }, [reservationSuccessDetail]);

  useEffect(() => {
    if (reservationStatus !== 'held') {
      setCardComplete(false);
    }
  }, [reservationStatus]);

  useEffect(() => {
    if (paymentType !== 'deposit') {
      setDepositAcknowledged(false);
    }
  }, [paymentType]);

  useEffect(() => {
    return () => {
      clearPendingReserve();
      if (reservation?.id && !preserveReservation) {
        void releaseReservation(reservation.id);
      }
    };
  }, [reservation, preserveReservation, releaseReservation, clearPendingReserve]);

  useEffect(() => {
    if (reservationStatus === 'held' && reservation) {
      setModalStage('details');
      return;
    }

    if (!reservation && reservationStatus !== 'holding') {
      setModalStage('availability');
    }
  }, [reservationStatus, reservation]);

  useEffect(() => {
    console.log('[PaymentForm state]', {
      modalStage,
      reservationStatus,
      hasReservation: Boolean(reservation),
      hasSelectedSlot: Boolean(selectedSlot),
      reservationId: reservation?.id,
      selectedSlotStart: selectedSlot?.startTime,
    });
  }, [modalStage, reservationStatus, reservation, selectedSlot]);

  useEffect(() => {
    if (reservationStatus !== 'held' || reservationCountdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setReservationCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [reservationStatus, reservationCountdown]);

  useEffect(() => {
    if (reservationStatus === 'held' && reservationCountdown === 0 && reservation?.id) {
    const expirationMessage = 'Reservation timed out. Please select another time.';
    setReservationStatus('error');
    setReservationErrorDetail(expirationMessage);
    void (async () => {
      try {
        await releaseReservation(reservation.id, { preserveState: true });
      } finally {
        resetReservationState();
      }
    })();
    }
}, [reservationStatus, reservationCountdown, reservation, releaseReservation, resetReservationState]);

  const validateDiscount = async () => {
    if (!discountCode.trim()) {
      setDiscountValidation(null);
      return;
    }

    setValidatingDiscount(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/validate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: discountCode.trim().toUpperCase(),
          amount: baseAmount,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setDiscountValidation(data);
      } else {
        setDiscountValidation({ valid: false, discountAmount: 0, finalAmount: baseAmount, originalAmount: baseAmount });
        setError(data.error || 'Invalid discount code');
      }
    } catch (err) {
      setError('Failed to validate discount code');
      setDiscountValidation(null);
    } finally {
      setValidatingDiscount(false);
    }
  };


  const handlePayment = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      setError('Stripe is not loaded. Please refresh the page.');
      return;
    }

    if (!validateContactDetails()) {
      setError('Please correct the highlighted contact information.');
      return;
    }

    if (paymentType === 'deposit' && !depositAcknowledged) {
      setError('Please acknowledge that the remaining balance will be due at the appointment.');
      return;
    }

    if (!selectedSlot) {
      setSlotError('Please choose an appointment time before continuing.');
      return;
    }

    const trimmedContact: ContactDetails = {
      name: contactDetails.name.trim(),
      email: contactDetails.email.trim(),
      phone: contactDetails.phone.trim(),
      notes: contactDetails.notes.trim(),
    };

    if (reservationLoading) {
      setError('Please wait while we secure your selected time.');
      return;
    }

    if (!reservation || !reservationMatchesSelectedSlot) {
      setSlotError('We need to hold your selected time before continuing. Please wait a moment or reselect the slot.');
      setReservationErrorDetail((prev) =>
        prev || 'We are securing this time for you. If this message persists, pick the time again.'
      );
      return;
    }

    setProcessing(true);
    setError(null);
    setSlotError(null);

    try {
      // Create payment intent
      const intentResponse = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: serviceIdentifier,
          serviceName: service.name,
          amount: baseAmount,
          discountCode: discountValidation?.valid ? discountCode.toUpperCase() : null,
          paymentType,
          depositPercent: 50,
          clientName: trimmedContact.name,
          clientEmail: trimmedContact.email,
          clientPhone: trimmedContact.phone,
          clientNotes: trimmedContact.notes,
        }),
      });

      if (!intentResponse.ok) {
        const errorData = await intentResponse.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }

      const { clientSecret, paymentIntentId } = await intentResponse.json();

      // Confirm payment with card (required for deposit or full payments)
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment failed');
      }

      // For full/deposit payments, status should be 'succeeded' (or 'processing' for async methods)
      if (
        paymentIntent?.status === 'succeeded' || 
        paymentIntent?.status === 'requires_capture' ||
        paymentIntent?.status === 'processing'
      ) {
        // Create booking token for secure booking verification
        try {
          const tokenResponse = await fetch('/api/bookings/create-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentIntentId,
              selectedSlot: selectedSlot
                ? {
                    startTime: selectedSlot.startTime,
                    eventTypeId: selectedSlot.eventTypeId,
                    timezone: selectedSlot.timezone,
                    duration: selectedSlot.duration,
                    label: selectedSlot.label,
                  }
                : null,
              reservation: reservation
                ? {
                    id: reservation.id,
                    expiresAt: reservation.expiresAt,
                    startTime: reservation.startTime,
                    endTime: reservation.endTime,
                    timezone: reservation.timezone,
                  }
                : null,
              attendee: trimmedContact,
            }),
          });

          if (!tokenResponse.ok) {
            throw new Error('Failed to create booking token');
          }

          const tokenData = await tokenResponse.json();
          if (!tokenData.token) {
            throw new Error('Token not returned from server');
          }
          
          console.log('Booking token created successfully:', tokenData.token);
          setSuccess(true);
          const reservationSnapshot = reservation;
          
          // Small delay to show success message, then redirect
          setTimeout(() => {
            if (!reservationSnapshot) {
              setError('We lost the reservation for this time. Please contact support or try again.');
              setProcessing(false);
              return;
            }

            setPreserveReservation(true);
            try {
              onSuccess({
                paymentIntentId,
                discountCode: discountValidation?.valid ? discountCode.toUpperCase() : undefined,
                bookingToken: tokenData.token,
                paymentType,
                slot: selectedSlot,
                contact: trimmedContact,
                reservation: reservationSnapshot,
              });
            } catch (redirectError) {
              console.error('Redirect error:', redirectError);
              setError('Failed to redirect. Please manually navigate to the booking page.');
            }
          }, 1500);
        } catch (tokenError: any) {
          console.error('Token creation error:', tokenError);
          setError(`Failed to create booking token: ${tokenError.message}. Please contact support.`);
          setProcessing(false);
          // Don't proceed if token creation fails - security risk
        }
      } else {
        throw new Error(`Payment status: ${paymentIntent?.status}. Please try again.`);
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#3F3A37',
        fontFamily: 'Inter, system-ui, sans-serif',
        '::placeholder': {
          color: '#9CA3AF',
        },
      },
      invalid: {
        color: '#EF4444',
        iconColor: '#EF4444',
      },
    },
  };

  return (
    <form onSubmit={handlePayment} className="space-y-5 sm:space-y-6">
      {/* Service Summary */}
      {isAvailabilityStage && (
        <div className="space-y-4 sm:space-y-5">
          {(reservationStatus === 'holding' || (reservationStatus === 'error' && reservationErrorDetail)) && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm ${
                reservationStatus === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-600'
                  : 'bg-sand/50 border border-sand text-warm-gray'
              }`}
            >
              {reservationStatus === 'error' ? (
                <AlertCircle size={16} />
              ) : (
                <Loader2 className="animate-spin" size={16} />
              )}
              {reservationStatus === 'holding'
                ? reservationErrorDetail
                  ? reservationErrorDetail
                  : `Reserving your selected time... (attempt ${reservationAttempts || 1}/3)`
                : reservationErrorDetail}
            </div>
          )}

          <AvailabilityPanel
            serviceSlug={serviceSlug}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSlotSelection}
            hiddenSlotStart={reservation?.startTime ?? null}
            isSelectionDisabled={reservationStatus === 'holding' || reservationLoading}
          />

          {selectedSlot && (
            <div className="bg-dark-sage/10 border border-dark-sage/30 rounded-lg px-3 sm:px-4 py-2.5 text-sm text-charcoal">
              <p className="font-medium">Selected Slot</p>
              <p>{selectedSlot.label}</p>
              <p className="text-xs text-warm-gray">
                {selectedSlot.duration
                  ? `Duration: ${selectedSlot.duration} minutes`
                  : `Duration: ${service.duration}`}
              </p>
            </div>
          )}
        </div>
      )}

      {!isAvailabilityStage && reservation && selectedSlot && (
        <div className="space-y-5 sm:space-y-6">
          <div className="border border-dark-sage rounded-lg bg-dark-sage/10 px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-2.5">
            <div>
              <p className="text-sm font-medium text-charcoal">Step 2 · Confirm and checkout</p>
              <p className="text-sm text-charcoal">{selectedSlot.label}</p>
              <p className="text-xs text-warm-gray">
                Complete checkout within {reservationCountdown}s to keep this time reserved.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleChangeTime}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-dark-sage text-dark-sage hover:bg-sand/40 transition-colors"
              >
                Update selection
              </button>
              <button
                type="button"
                onClick={() => handleReleaseSlot('Slot released. Select a new time to continue.')}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-red-500 text-red-600 hover:bg-red-50 transition-colors"
              >
                Release slot
              </button>
            </div>

            {reservationSuccessDetail && (
              <div className="text-xs text-green-700">{reservationSuccessDetail}</div>
            )}

            {reservationStatus === 'error' && reservationErrorDetail && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs sm:text-sm text-red-600 flex items-center gap-2">
                <AlertCircle size={16} />
                {reservationErrorDetail}
              </div>
            )}
          </div>

          <div className="border border-sand rounded-lg p-3 sm:p-4 bg-white">
            <h3 className="font-serif text-base sm:text-lg text-charcoal mb-2.5 sm:mb-3">Your Information</h3>
            <div className="grid gap-3 md:gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-charcoal mb-1" htmlFor="booking-name">
                  Full Name
                </label>
                <input
                  id="booking-name"
                  type="text"
                  value={contactDetails.name}
                  onChange={(event) => {
                    setContactDetails((prev) => ({ ...prev, name: event.target.value }));
                    setContactErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  onBlur={validateContactDetails}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2 sm:px-4 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                  disabled={processing}
                />
                {contactErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{contactErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-charcoal mb-1" htmlFor="booking-email">
                  Email Address
                </label>
                <input
                  id="booking-email"
                  type="email"
                  value={contactDetails.email}
                  onChange={(event) => {
                    setContactDetails((prev) => ({ ...prev, email: event.target.value }));
                    setContactErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  onBlur={validateContactDetails}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 sm:px-4 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                  disabled={processing}
                />
                {contactErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{contactErrors.email}</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:gap-4 md:grid-cols-2 mt-3 sm:mt-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-charcoal mb-1" htmlFor="booking-phone">
                  Phone Number
                </label>
                <input
                  id="booking-phone"
                  type="tel"
                  value={contactDetails.phone}
                  onChange={(event) => {
                    setContactDetails((prev) => ({ ...prev, phone: event.target.value }));
                    setContactErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  onBlur={validateContactDetails}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 sm:px-4 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                  disabled={processing}
                />
                {contactErrors.phone && (
                  <p className="text-xs text-red-600 mt-1">{contactErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-charcoal mb-1" htmlFor="booking-notes">
                  Notes (Optional)
                </label>
                <textarea
                  id="booking-notes"
                  value={contactDetails.notes}
                  onChange={(event) => {
                    setContactDetails((prev) => ({ ...prev, notes: event.target.value }));
                  }}
                  placeholder="Let us know any preferences or special requests."
                  rows={3}
                  className="w-full px-3 py-2 sm:px-4 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage resize-none text-sm"
                  disabled={processing}
                />
              </div>
            </div>
          </div>

          {shouldShowPaymentSections ? (
            <>
      {/* Discount Code */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-charcoal mb-2">
          Discount Code (Optional)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={discountCode}
            onChange={(e) => {
              setDiscountCode(e.target.value.toUpperCase());
              setDiscountValidation(null);
              setError(null);
            }}
            onKeyDown={(e) => {
              // Allow Enter key to trigger validation
              if (e.key === 'Enter') {
                e.preventDefault();
                if (discountCode.trim() && !processing && !validatingDiscount) {
                  validateDiscount();
                }
              }
            }}
            placeholder="Enter code"
            className="flex-1 px-3 py-2 sm:px-4 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
            disabled={processing || validatingDiscount}
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              validateDiscount();
            }}
            disabled={processing || validatingDiscount || !discountCode.trim()}
            className="px-3 sm:px-4 py-2 bg-dark-sage text-charcoal rounded-lg font-medium text-sm hover:bg-sage-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {validatingDiscount ? '...' : 'Apply'}
          </button>
        </div>
        {discountValidation?.valid && (
          <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 size={16} />
            Discount applied! ${discountValidation.discountAmount.toFixed(2)} off
          </p>
        )}
        {discountValidation && !discountValidation.valid && discountCode && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle size={16} />
            Invalid discount code
          </p>
        )}
      </div>

      {/* Payment Type Selection */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-charcoal mb-2.5 sm:mb-3">
          Payment Option
        </label>
        <div className="space-y-2">
          <label className="flex items-center p-3 sm:p-4 border-2 rounded-lg cursor-pointer hover:bg-sand/20 transition-colors">
            <input
              type="radio"
              name="paymentType"
              value="full"
              checked={paymentType === 'full'}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="mr-2.5"
              disabled={processing}
            />
            <div className="flex-1">
              <div className="font-medium text-charcoal">Pay Full Amount</div>
              <div className="text-sm text-warm-gray">
                ${(discountValidation?.finalAmount || baseAmount).toFixed(2)}
              </div>
            </div>
          </label>
          <label className="flex items-center p-3 sm:p-4 border-2 rounded-lg cursor-pointer hover:bg-sand/20 transition-colors">
            <input
              type="radio"
              name="paymentType"
              value="deposit"
              checked={paymentType === 'deposit'}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="mr-2.5"
              disabled={processing}
            />
            <div className="flex-1">
              <div className="font-medium text-charcoal">Pay 50% Deposit</div>
              <div className="text-sm text-warm-gray">
                ${((discountValidation?.finalAmount || baseAmount) * 0.5).toFixed(2)} now, remainder later
              </div>
            </div>
          </label>
        </div>

        {paymentType === 'deposit' && (
          <div className="mt-3 flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <input
              id="deposit-ack"
              type="checkbox"
              checked={depositAcknowledged}
              onChange={(event) => setDepositAcknowledged(event.target.checked)}
              className="mt-1"
              disabled={processing}
            />
            <label htmlFor="deposit-ack" className="text-xs text-yellow-700 leading-relaxed">
              I understand the remaining balance will be due at the start of my appointment.
            </label>
          </div>
        )}
      </div>

      {/* Card Input (required for all payment types) */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-charcoal mb-1.5 sm:mb-2">
          Card Information
        </label>
        <div className="p-3 sm:p-4 border border-sage-dark rounded-lg bg-white">
          <CardElement
            options={cardElementOptions}
            onChange={(event) => setCardComplete(event.complete)}
          />
        </div>
      </div>

      {/* Total Amount */}
      <div className="bg-dark-sage/10 p-3 sm:p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium text-charcoal text-sm sm:text-base">
            {paymentType === 'deposit' ? 'Deposit Due Today' : 'Total Amount'}
          </span>
          <span className="text-xl sm:text-2xl font-serif font-bold text-charcoal">
            ${currentAmount.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 text-xs sm:text-sm text-warm-gray space-y-1">
          <div>
            Original: ${baseAmount.toFixed(2)}
            {discountValidation?.valid && (
              <>
                <span className="mx-2">-</span>
                <span className="text-green-600">
                  Discount: ${discountValidation.discountAmount.toFixed(2)}
                </span>
              </>
            )}
          </div>
          {paymentType === 'deposit' && (
            <div>Balance due at appointment: ${balanceDue.toFixed(2)}</div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          Payment successful! Redirecting to booking...
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={processing || success}
          className="flex-1 px-6 sm:px-8 py-3 rounded font-medium transition-all duration-200 min-h-[44px] inline-flex items-center justify-center bg-white border-2 border-dark-sage text-dark-sage hover:bg-sage-light hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            processing ||
            success ||
            !stripe ||
            reservationLoading ||
            !shouldShowPaymentSections ||
            !cardComplete ||
            !contactInfoReady ||
            (paymentType === 'deposit' && !depositAcknowledged) ||
            !reservationMatchesSelectedSlot
          }
          className="flex-1 px-6 sm:px-8 py-3 rounded font-medium transition-all duration-200 min-h-[44px] inline-flex items-center justify-center bg-dark-sage text-charcoal hover:bg-sage-dark hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Processing...
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="mr-2" size={18} />
              Success!
            </>
          ) : paymentType === 'deposit' ? (
            `Pay Deposit $${currentAmount.toFixed(2)}`
          ) : (
            `Pay $${currentAmount.toFixed(2)}`
          )}
        </button>
      </div>
            </>
          ) : (
            <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-warm-gray">
              {reservationSuccessDetail ??
                'Securing your slot now. Once confirmed, your payment details will appear here.'}
            </div>
          )}
        </div>
      )}

      {!isAvailabilityStage && (!reservation || !selectedSlot) && (
        <div className="p-3 bg-sand/30 border border-sand rounded-lg text-xs sm:text-sm text-warm-gray">
          Preparing your reserved slot...
        </div>
      )}

      {slotError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertCircle size={16} />
          {slotError}
        </div>
      )}
    </form>
  );
}

export default function CustomPaymentModal({ isOpen, onClose, service }: CustomPaymentModalProps) {
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState<string | undefined>();
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [slotSelection, setSlotSelection] = useState<SlotSelectionPayload | null>(null);
  const [contactDetails, setContactDetails] = useState<ContactDetails | null>(null);
  const [reservationInfo, setReservationInfo] = useState<ReservationInfo | null>(null);
  const [modalStage, setModalStage] = useState<'availability' | 'details'>('availability');
  const serviceSlug = deriveServiceSlug(service);
  const primaryPhoto = useMemo(() => {
    if (!service?.slug) return null;
    const photos = getServicePhotoPaths(service.slug);
    return photos.length > 0 ? photos[0] : null;
  }, [service?.slug]);

  useEffect(() => {
    if (!isOpen) {
      setModalStage('availability');
    }
  }, [isOpen]);

  const handlePaymentSuccess = ({
    paymentIntentId,
    discountCode: code,
    bookingToken,
    paymentType,
    slot,
    contact,
    reservation,
  }: {
    paymentIntentId: string;
    discountCode?: string;
    bookingToken: string;
    paymentType: PaymentType;
    slot: SlotSelectionPayload;
    contact: ContactDetails;
    reservation: ReservationInfo;
  }) => {
    setPaymentIntentId(paymentIntentId);
    setDiscountCode(code);
    setRedirectError(null);
    setSlotSelection(slot);
    setContactDetails(contact);
    setReservationInfo(reservation);
    
    // Redirect to verification page first, then to Cal.com
    if (service?.calBookingUrl) {
      const calLink = extractCalLink(service.calBookingUrl);
      if (calLink && bookingToken) {
        const metadata = {
          paymentIntentId,
          discountCode: code || '',
          paymentType,
          bookingToken: bookingToken, // Secure token for verification
          selectedSlot: slot,
          serviceSlug,
          contact,
          reservation,
        };
        
        // Build verify URL with all required parameters
        const params = new URLSearchParams({
          token: bookingToken,
          paymentIntentId,
          paymentType,
          calLink: calLink,
          metadata: JSON.stringify(metadata),
          selectedSlot: JSON.stringify(slot),
        });
      if (serviceSlug) {
        params.append('serviceSlug', serviceSlug);
      }
      if (reservation) {
        params.append('reservation', JSON.stringify(reservation));
      }
      if (contact) {
        params.append('contact', JSON.stringify(contact));
      }
        
        // Redirect to verification page first (prevents direct Cal.com access)
        const verifyUrl = `/book/verify?${params.toString()}`;
        console.log('Redirecting to verify page:', verifyUrl);
        
        try {
          window.location.href = verifyUrl;
        } catch (error) {
          console.error('Redirect error:', error);
          setRedirectError('Failed to redirect. Please manually navigate to the booking page.');
        }
      } else {
        console.error('No Cal.com link or booking token found:', { calLink, bookingToken, service });
        setRedirectError('Missing booking information. Please contact support.');
      }
    } else {
      console.error('No service or calBookingUrl found');
      setRedirectError('Missing service information. Please contact support.');
    }
  };

  if (!service) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="bg-white rounded-lg max-w-5xl w-[min(95vw,1100px)] max-h-[90vh] overflow-y-auto shadow-xl relative px-2 pt-2 pb-6 md:px-4"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 hover:bg-sand/30 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X size={20} className="text-charcoal" />
              </button>

              {/* Content */}
              <div className="px-4 pt-1 pb-5 sm:px-8 sm:pb-8">
                <div className="mb-4 sm:mb-5 relative">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      {primaryPhoto ? (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-sand/40 flex-shrink-0 shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={primaryPhoto}
                            alt={`${service.name} preview`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-sand/60 flex items-center justify-center text-xs text-warm-gray uppercase tracking-wide flex-shrink-0">
                          {service.name.slice(0, 2)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <span className="inline-block px-2.5 py-0.5 bg-dark-sage/20 text-dark-sage text-[11px] sm:text-xs font-medium rounded-full mb-2">
                          {service.category}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-serif text-charcoal mb-1 sm:mb-1.5">
                          {service.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-warm-gray mb-2">
                          <span className="flex items-center gap-1">
                            Duration:
                            <span className="text-charcoal font-medium">{service.duration}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            Base Price:
                            <span className="text-charcoal font-medium">{service.price}</span>
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-warm-gray">
                          Secure your appointment with a payment
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block absolute right-0 top-1/2 md:translate-y-[-10%] lg:translate-y-[-15%]">
                    <div className="min-w-[190px] rounded-lg border border-dark-sage/40 bg-dark-sage/10 px-3.5 py-2.5 shadow-sm text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-dark-sage/80">
                        Current Step
                      </p>
                      <p className="text-sm font-semibold text-charcoal">
                        {modalStage === 'availability' ? 'Step 1 · Choose your time' : 'Step 2 · Confirm & pay'}
                      </p>
                      <p className="text-xs text-warm-gray mt-1 leading-snug">
                        {modalStage === 'availability'
                          ? 'Select an available slot to place a short hold.'
                          : 'Enter your details and payment to secure the booking.'}
                      </p>
                    </div>
                  </div>

                  <div className="md:hidden mt-3 rounded-lg border border-dark-sage/40 bg-dark-sage/10 px-3 py-2 shadow-sm">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dark-sage/80">
                      Current Step
                    </p>
                    <p className="text-sm font-semibold text-charcoal">
                      {modalStage === 'availability' ? 'Step 1 · Choose your time' : 'Step 2 · Confirm & pay'}
                    </p>
                    <p className="text-xs text-warm-gray mt-1 leading-snug">
                      {modalStage === 'availability'
                        ? 'Select an available slot to place a short hold.'
                        : 'Enter your details and payment to secure the booking.'}
                    </p>
                  </div>
                </div>

                {redirectError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{redirectError}</p>
                  </div>
                )}
                <Elements stripe={stripePromise}>
                  <PaymentForm 
                    service={service} 
                    onSuccess={handlePaymentSuccess}
                    onClose={onClose}
                    modalStage={modalStage}
                    setModalStage={setModalStage}
                  />
                </Elements>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

