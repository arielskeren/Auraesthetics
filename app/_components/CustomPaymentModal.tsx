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
import { useState, useEffect, FormEvent, useCallback, useMemo } from 'react';
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

function formatDateHeading(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatTimeLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function AvailabilityPanel({
  serviceSlug,
  selectedSlot,
  onSelectSlot,
}: {
  serviceSlug: string;
  selectedSlot: SlotSelectionPayload | null;
  onSelectSlot: (slot: SlotSelectionPayload | null) => void;
}) {
  const [pageOffset, setPageOffset] = useState(0);
  const [daysPerPage, setDaysPerPage] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AvailabilityData | null>(null);

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
  const timezoneFromData = data?.meta?.timezone || 'America/New_York';

  useEffect(() => {
    let isMounted = true;

    if (!serviceSlug) {
      setLoading(false);
      setData(null);
      setError(null);
      onSelectSlot(null);
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
  }, [serviceSlug, pageOffset, startKey, onSelectSlot, daysPerPage]);

  useEffect(() => {
    // Reset selection when service slug changes
    onSelectSlot(null);
  }, [serviceSlug, onSelectSlot]);

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
    const timezone = data.meta?.timezone || slot.attendeeTimezone || 'America/New_York';
    const slotDate = new Date(startTime);
    const label = `${formatDateHeading(slotDate)} at ${formatTimeLabel(slotDate)} (${timezone})`;
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

      <div className="p-3">
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
              className={`grid gap-3 ${daysPerPage === 7 ? 'min-w-[940px] lg:min-w-0' : ''}`}
              style={{ gridTemplateColumns: `repeat(${daysPerPage}, minmax(0, 1fr))` }}
            >
              {orderedDays.map(({ key, date, slots }) => (
                <div key={key} className="border border-sand rounded-lg p-3 flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-medium text-charcoal">
                      {formatDateHeading(date)}
                    </p>
                    <p className="text-xs text-warm-gray">
                      {new Intl.DateTimeFormat('en-US', {
                        weekday: 'long',
                        timeZone: timezoneFromData,
                      }).format(date)}
                    </p>
                  </div>

                  {slots.length === 0 ? (
                    <div className="text-xs text-warm-gray italic">No availability</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {slots.map((slot) => {
                        const slotDate = new Date(slot.slot);
                        const label = formatTimeLabel(slotDate);
                        const isSelected = selectedSlot?.startTime === slot.slot;
                        return (
                          <button
                            key={slot.slot}
                            type="button"
                            onClick={() => handleSlotClick(slot)}
                            className={`block w-full px-3 py-2 rounded-md border text-sm font-medium leading-tight text-center transition-colors ${
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

        <div className="mt-3 text-xs text-warm-gray">
          Times adjust automatically to your browser timezone.
        </div>

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
  onClose 
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
}) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [paymentType, setPaymentType] = useState<PaymentType>('deposit');
  const [discountCode, setDiscountCode] = useState('');
  const [discountValidation, setDiscountValidation] = useState<DiscountValidation | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [preserveReservation, setPreserveReservation] = useState(false);

  const serviceSlug = deriveServiceSlug(service);
  const serviceIdentifier = serviceSlug || (service?.name ? service.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') : 'service');

  const reservationExpiryLabel = useMemo(() => {
    if (!reservation?.expiresAt) {
      return null;
    }
    const expires = new Date(reservation.expiresAt);
    if (Number.isNaN(expires.getTime())) {
      return null;
    }
    return expires.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [reservation?.expiresAt]);

  const isContactInfoComplete = useCallback(() => {
    return Boolean(
      contactDetails.name.trim() &&
      contactDetails.email.trim() &&
      contactDetails.phone.trim()
    );
  }, [contactDetails]);

  const handleSlotSelection = useCallback(
    (slot: SlotSelectionPayload | null) => {
      if (!slot) {
        setSelectedSlot(null);
        setSlotError(null);
        setReservationError(null);
        setPreserveReservation(false);
        if (reservation?.id) {
          void releaseReservation(reservation.id);
        }
        return;
      }

      setSelectedSlot(slot);
      setSlotError(null);
      setReservationError(null);
      setPreserveReservation(false);
    },
    [releaseReservation, reservation]
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
    if (!selectedSlot) {
      setReservationError(null);
      return;
    }

    if (!isContactInfoComplete()) {
      setReservationError('Enter your contact information to hold this time.');
      return;
    }

    if (reservationLoading) {
      return;
    }

    if (reservation && reservation.startTime === selectedSlot.startTime) {
      setReservationError(null);
      return;
    }

    const contact: ContactDetails = {
      name: contactDetails.name.trim(),
      email: contactDetails.email.trim(),
      phone: contactDetails.phone.trim(),
      notes: contactDetails.notes.trim(),
    };

    void reserveSlot(selectedSlot, contact);
  }, [
    selectedSlot,
    contactDetails,
    isContactInfoComplete,
    reservation,
    reservationLoading,
    reserveSlot,
  ]);

  useEffect(() => {
    return () => {
      if (reservation?.id && !preserveReservation) {
        void releaseReservation(reservation.id);
      }
    };
  }, [reservation, preserveReservation, releaseReservation]);

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
          setReservation((current) => {
            if (current && current.id === reservationId) {
              return null;
            }
            return current;
          });
        }
      }
    },
    []
  );

  const reserveSlot = useCallback(
    async (slot: SlotSelectionPayload, contact: ContactDetails) => {
      const previousReservation = reservation;
      setReservationLoading(true);
      setReservationError(null);

      const start = slot.startTime;
      let end: string | null = null;
      if (slot.duration && Number.isFinite(slot.duration)) {
        const startDate = new Date(start);
        const endDate = new Date(startDate.getTime() + slot.duration * 60 * 1000);
        end = endDate.toISOString();
      }

      try {
        const response = await fetch('/api/cal/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventTypeId: slot.eventTypeId,
            startTime: start,
            endTime: end,
            timezone: slot.timezone,
            attendee: {
              name: contact.name,
              email: contact.email,
              smsReminderNumber: contact.phone,
            },
            notes: contact.notes,
            metadata: {
              serviceSlug,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Failed to reserve slot');
        }

        const body = await response.json();
        const reservationPayload = body.reservation ?? body.data ?? body;

        const newReservation: ReservationInfo = {
          id: reservationPayload.id,
          expiresAt: reservationPayload.expiresAt ?? null,
          startTime: reservationPayload.startTime ?? start,
          endTime: reservationPayload.endTime ?? end,
          timezone: reservationPayload.timezone ?? slot.timezone,
        };

        if (!newReservation.id) {
          throw new Error('Failed to reserve slot: missing reservation ID');
        }

        setReservation(newReservation);
        setReservationError(null);

        if (previousReservation && previousReservation.id !== newReservation.id) {
          void releaseReservation(previousReservation.id, { preserveState: true });
        }
      } catch (error: any) {
        console.error('Failed to reserve slot:', error);
        setReservationError(error.message || 'Unable to reserve this time. Please try again.');
      } finally {
        setReservationLoading(false);
      }
    },
    [reservation, releaseReservation, serviceSlug]
  );

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

    if (!reservation || reservation.startTime !== selectedSlot.startTime) {
      setSlotError('We need to hold your selected time before continuing. Please wait a moment or reselect the slot.');
      setReservationError((prev) =>
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
    <form onSubmit={handlePayment} className="space-y-6">
      {/* Service Summary */}
      <div className="bg-sand/30 p-4 rounded-lg">
        <h3 className="font-serif text-lg text-charcoal mb-2">{service.name}</h3>
        <div className="flex justify-between text-sm text-warm-gray">
          <span>Duration: {service.duration}</span>
          <span className="font-medium">Base Price: ${baseAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Contact Information */}
      <div className="border border-sand rounded-lg p-4">
        <h3 className="font-serif text-lg text-charcoal mb-3">Your Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1" htmlFor="booking-name">
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
              className="w-full px-4 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
              disabled={processing}
            />
            {contactErrors.name && (
              <p className="text-xs text-red-600 mt-1">{contactErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1" htmlFor="booking-email">
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
              className="w-full px-4 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
              disabled={processing}
            />
            {contactErrors.email && (
              <p className="text-xs text-red-600 mt-1">{contactErrors.email}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1" htmlFor="booking-phone">
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
              className="w-full px-4 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
              disabled={processing}
            />
            {contactErrors.phone && (
              <p className="text-xs text-red-600 mt-1">{contactErrors.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1" htmlFor="booking-notes">
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
              className="w-full px-4 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage resize-none"
              disabled={processing}
            />
          </div>
        </div>
      </div>

      <AvailabilityPanel
        serviceSlug={serviceSlug}
        selectedSlot={selectedSlot}
        onSelectSlot={handleSlotSelection}
      />

      {slotError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertCircle size={16} />
          {slotError}
        </div>
      )}

      {selectedSlot && (
        <div className="bg-dark-sage/10 border border-dark-sage/40 rounded-lg px-4 py-3 mb-2 text-sm text-charcoal flex flex-col gap-1">
          <span className="font-medium">Selected Slot</span>
          <span>{selectedSlot.label}</span>
          <span className="text-xs text-warm-gray">
            Duration: {selectedSlot.duration ? `${selectedSlot.duration} minutes` : service.duration}
          </span>
        </div>
      )}

      {reservationLoading && (
        <div className="mb-3 flex items-center gap-2 text-sm text-warm-gray">
          <Loader2 className="animate-spin" size={16} />
          Holding your selected time...
        </div>
      )}

      {reservation && selectedSlot && reservation.startTime === selectedSlot.startTime && (
        <div className="mb-3 flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 size={16} />
          Slot reserved{reservationExpiryLabel ? ` until ${reservationExpiryLabel}` : ''}.
        </div>
      )}

      {reservationError && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {reservationError}
        </div>
      )}

      {/* Discount Code */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
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
            className="flex-1 px-4 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
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
            className="px-4 py-2 bg-dark-sage text-charcoal rounded-lg font-medium hover:bg-sage-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <label className="block text-sm font-medium text-charcoal mb-3">
          Payment Option
        </label>
        <div className="space-y-2">
          <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-sand/20 transition-colors">
            <input
              type="radio"
              name="paymentType"
              value="full"
              checked={paymentType === 'full'}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="mr-3"
              disabled={processing}
            />
            <div className="flex-1">
              <div className="font-medium text-charcoal">Pay Full Amount</div>
              <div className="text-sm text-warm-gray">
                ${(discountValidation?.finalAmount || baseAmount).toFixed(2)}
              </div>
            </div>
          </label>
          <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-sand/20 transition-colors">
            <input
              type="radio"
              name="paymentType"
              value="deposit"
              checked={paymentType === 'deposit'}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="mr-3"
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
      </div>

      {/* Card Input (required for all payment types) */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
          Card Information
        </label>
        <div className="p-4 border border-sage-dark rounded-lg bg-white">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {/* Total Amount */}
      <div className="bg-dark-sage/10 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium text-charcoal">
            {paymentType === 'deposit' ? 'Deposit Due Today' : 'Total Amount'}
          </span>
          <span className="text-2xl font-serif font-bold text-charcoal">
            ${currentAmount.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 text-sm text-warm-gray space-y-1">
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
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            if (reservation?.id) {
              setPreserveReservation(false);
              void releaseReservation(reservation.id);
            }
            onClose();
          }}
          disabled={processing || success}
          className="flex-1 px-8 py-3 rounded font-medium transition-all duration-200 min-h-[44px] inline-flex items-center justify-center bg-white border-2 border-dark-sage text-dark-sage hover:bg-sage-light hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={processing || success || !stripe || reservationLoading}
          className="flex-1 px-8 py-3 rounded font-medium transition-all duration-200 min-h-[44px] inline-flex items-center justify-center bg-dark-sage text-charcoal hover:bg-sage-dark hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
  const serviceSlug = deriveServiceSlug(service);
  const primaryPhoto = useMemo(() => {
    if (!service?.slug) return null;
    const photos = getServicePhotoPaths(service.slug);
    return photos.length > 0 ? photos[0] : null;
  }, [service?.slug]);

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
              <div className="px-4 pb-4 md:px-8 md:pb-8">
                <div className="mb-6">
                  <span className="inline-block px-3 py-1 bg-dark-sage/20 text-dark-sage text-xs font-medium rounded-full mb-3">
                    {service.category}
                  </span>
                  <h2 className="text-2xl font-serif text-charcoal mb-2">Complete Your Booking</h2>
                  <p className="text-sm text-warm-gray">
                    Secure your appointment with a payment
                  </p>
                </div>

                {primaryPhoto && (
                  <div className="mb-6 rounded-lg overflow-hidden shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={primaryPhoto}
                      alt={`${service.name} preview`}
                      className="w-full h-40 object-cover"
                    />
                  </div>
                )}

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

