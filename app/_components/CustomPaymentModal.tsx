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
import { useState, useEffect, FormEvent, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { extractCalLink } from '../_hooks/useCalEmbed';
import Button from './Button';

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

function formatDateHeading(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(date);
}

function formatTimeLabel(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

function formatDateKeyForTimezone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    console.warn('Failed to format date key for timezone', timeZone, error);
  }

  return date.toISOString().split('T')[0];
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AvailabilityData | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileStartIndex, setMobileStartIndex] = useState(0);

  const MOBILE_COLUMNS = 3;

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  if (weekOffset > 0) {
    startDate.setDate(startDate.getDate() + weekOffset * 7);
  }
  const startKey = startDate.toISOString();

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
          `/api/cal/availability?slug=${serviceSlug}&start=${startKey}&days=7`
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
  }, [serviceSlug, weekOffset, startKey, onSelectSlot]);

  useEffect(() => {
    // Reset selection when service slug changes
    onSelectSlot(null);
  }, [serviceSlug, onSelectSlot]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobileView(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const timezoneFromData = data?.meta?.timezone || 'America/New_York';

  const groupedSlots = (data?.availability || []).reduce(
    (acc, slot) => {
      const date = new Date(slot.slot);
      const dayKey = formatDateKeyForTimezone(date, timezoneFromData);
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(slot);
      return acc;
    },
    {} as Record<string, AvailabilitySlot[]>
  );

  const dayRange = Array.from({ length: 7 }, (_, idx) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + idx);
    const key = formatDateKeyForTimezone(day, timezoneFromData);
    return {
      key,
      date: day,
      slots: groupedSlots[key] || [],
    };
  });

  const orderedDays = dayRange;

  useEffect(() => {
    if (!isMobileView) {
      setMobileStartIndex(0);
      return;
    }
    setMobileStartIndex((prev) => {
      const total = orderedDays.length;
      if (total === 0) return 0;
      if (prev >= total) {
        return Math.max(0, total - MOBILE_COLUMNS);
      }
      return prev;
    });
  }, [isMobileView, orderedDays.length]);

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

  const totalDays = orderedDays.length;
  const maxMobileStart = Math.max(0, totalDays - MOBILE_COLUMNS);
  const mobileVisibleStart = isMobileView ? Math.min(mobileStartIndex, maxMobileStart) : 0;
  const mobileVisibleEnd = mobileVisibleStart + MOBILE_COLUMNS;

  const visibleDays = isMobileView
    ? orderedDays.slice(mobileVisibleStart, Math.min(mobileVisibleEnd, totalDays))
    : orderedDays;

  const canPageBackward = isMobileView && mobileVisibleStart > 0;
  const canPageForward = isMobileView && mobileVisibleStart + MOBILE_COLUMNS < totalDays;

  const handleMobilePrev = () => {
    setMobileStartIndex((prev) => Math.max(0, prev - MOBILE_COLUMNS));
  };

  const handleMobileNext = () => {
    setMobileStartIndex((prev) => Math.min(maxMobileStart, prev + MOBILE_COLUMNS));
  };

  const disablePrevious = weekOffset <= 0;

  return (
    <div className="mb-6 border border-sand rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-sand/40 border-b border-sand">
        <div className="flex items-center gap-2 text-charcoal">
          <CalendarDays size={18} />
          <div>
            <p className="text-sm font-medium">Availability</p>
            <p className="text-xs text-warm-gray">
              {formatDateHeading(startDate)} →{' '}
              {formatDateHeading(new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
            disabled={disablePrevious || loading}
            className="p-2 rounded-full border border-sage-dark text-sage-dark hover:bg-sand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            disabled={loading}
            className="p-2 rounded-full border border-sage-dark text-sage-dark hover:bg-sand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="p-4">
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
          <div className="flex flex-col gap-4">
            {isMobileView && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleMobilePrev}
                  disabled={!canPageBackward || loading}
                  className="p-2 rounded-full border border-sage-dark text-sage-dark hover:bg-sand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous days"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleMobileNext}
                  disabled={!canPageForward || loading}
                  className="p-2 rounded-full border border-sage-dark text-sage-dark hover:bg-sand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next days"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${visibleDays.length || 1}, minmax(0, 1fr))`,
              }}
            >
              {visibleDays.map(({ key, date, slots }) => (
                <div key={key} className="border border-sand rounded-lg p-4 flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-medium text-charcoal">
                      {formatDateHeading(date, timezoneFromData)}
                    </p>
                    <p className="text-xs text-warm-gray">
                      {new Intl.DateTimeFormat('en-US', {
                        timeZone: timezoneFromData,
                        weekday: 'long',
                      }).format(date)}
                    </p>
                  </div>

                  {slots.length === 0 ? (
                    <div className="text-xs text-warm-gray italic">No availability</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {slots.map((slot) => {
                        const slotDate = new Date(slot.slot);
                        const label = formatTimeLabel(slotDate, timezoneFromData);
                        const isSelected = selectedSlot?.startTime === slot.slot;
                        return (
                          <button
                            key={slot.slot}
                            type="button"
                            onClick={() => handleSlotClick(slot)}
                            className={`w-full px-3 py-2 rounded-full border text-sm transition-colors ${
                              isSelected
                                ? 'bg-dark-sage text-charcoal border-dark-sage'
                                : 'border-sage-dark text-sage-dark hover:bg-sand/40'
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
  onSuccess: (
    paymentIntentId: string,
    discountCode: string | undefined,
    bookingToken: string | undefined,
    paymentType: PaymentType,
    slot: SlotSelectionPayload
  ) => void;
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
  const [selectedSlot, setSelectedSlot] = useState<SlotSelectionPayload | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  const serviceSlug = deriveServiceSlug(service);
  const serviceIdentifier = serviceSlug || (service?.name ? service.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') : 'service');

  const handleSlotSelection = useCallback((slot: SlotSelectionPayload | null) => {
    setSelectedSlot(slot);
    setSlotError(null);
  }, []);

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

    if (!selectedSlot) {
      setSlotError('Please choose an appointment time before continuing.');
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
          
          // Small delay to show success message, then redirect
          setTimeout(() => {
            try {
              onSuccess(
                paymentIntentId, 
                discountValidation?.valid ? discountCode.toUpperCase() : undefined, 
                tokenData.token,
                paymentType,
                selectedSlot
              );
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
          onClick={onClose}
          disabled={processing || success}
          className="flex-1 px-8 py-3 rounded font-medium transition-all duration-200 min-h-[44px] inline-flex items-center justify-center bg-white border-2 border-dark-sage text-dark-sage hover:bg-sage-light hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={processing || success || !stripe}
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
  const serviceSlug = deriveServiceSlug(service);

  const handlePaymentSuccess = (
    intentId: string,
    code: string | undefined,
    bookingToken: string | undefined,
    paymentType: PaymentType,
    slot: SlotSelectionPayload
  ) => {
    setPaymentIntentId(intentId);
    setDiscountCode(code);
    setRedirectError(null);
    setSlotSelection(slot);
    
    // Redirect to verification page first, then to Cal.com
    if (service?.calBookingUrl) {
      const calLink = extractCalLink(service.calBookingUrl);
      if (calLink && bookingToken) {
        const metadata = {
          paymentIntentId: intentId,
          discountCode: code || '',
          paymentType,
          bookingToken: bookingToken, // Secure token for verification
        selectedSlot: slot,
        serviceSlug,
        };
        
        // Build verify URL with all required parameters
        const params = new URLSearchParams({
          token: bookingToken,
          paymentIntentId: intentId,
          paymentType,
          calLink: calLink,
          metadata: JSON.stringify(metadata),
          selectedSlot: JSON.stringify(slot),
        });
      if (serviceSlug) {
        params.append('serviceSlug', serviceSlug);
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
              className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl relative"
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
              <div className="p-8">
                <div className="mb-6">
                  <span className="inline-block px-3 py-1 bg-dark-sage/20 text-dark-sage text-xs font-medium rounded-full mb-3">
                    {service.category}
                  </span>
                  <h2 className="text-2xl font-serif text-charcoal mb-2">Complete Your Booking</h2>
                  <p className="text-sm text-warm-gray">
                    Secure your appointment with a payment
                  </p>
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

