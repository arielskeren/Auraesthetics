'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

import Button from './Button';
import { useBodyScrollLock } from '../_hooks/useBodyScrollLock';
import { getServicePhotoPaths } from '../_utils/servicePhotos';

type PaymentType = 'full' | 'deposit';

interface ContactDetails {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface ServiceSummary {
  name: string;
  price: string;
  duration: string;
  category: string;
  slug?: string;
}

interface ModernPaymentSectionProps {
  service: ServiceSummary;
  onClose: () => void;
  onSuccess: (payload: PaymentSuccessPayload) => void;
  onContactChange: (contact: ContactDetails) => void;
  pendingBooking: PendingBooking | null;
}

interface PaymentSuccessPayload {
  paymentIntentId: string;
  paymentType: PaymentType;
  amountPaid: number;
  discountCode?: string;
  contact: ContactDetails;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 15);
  if (!digits) return '';

  const countryCode = digits.length > 10 ? digits.slice(0, digits.length - 10) : '';
  const core = digits.slice(-10);
  const area = core.slice(0, 3);
  const middle = core.slice(3, 6);
  const last = core.slice(6);

  const formattedCore =
    last.length > 0
      ? `(${area}) ${middle}-${last}`
      : middle.length > 0
      ? `(${area}) ${middle}`
      : area;

  return countryCode ? `+${countryCode} ${formattedCore}` : formattedCore;
}

function normalizePhoneForSubmit(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.length === 10 ? digits : `+${digits}`;
  }
  return value.trim();
}

function hasFirstAndLastName(value: string): boolean {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhoneDisplay(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10;
}

function deriveServiceSlug(service: ServiceSummary | null): string {
  if (!service) return '';
  if (service.slug) return service.slug;
  return service.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
}

function extractNumericPrice(priceString: string): number {
  const match = priceString.match(/\$?(\d+(\.\d{1,2})?)/);
  return match ? parseFloat(match[1]) : 0;
}

function ModernPaymentSection({
  service,
  onSuccess,
  onClose,
  onContactChange,
  pendingBooking,
}: ModernPaymentSectionProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [discountCode, setDiscountCode] = useState('');
  const [discountValidation, setDiscountValidation] = useState<{
    valid: boolean;
    discountAmount: number;
    finalAmount: number;
    originalAmount: number;
  } | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [depositAcknowledged, setDepositAcknowledged] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [contactDetails, setContactDetails] = useState<ContactDetails>({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });
  useEffect(() => {
    onContactChange(contactDetails);
  }, [contactDetails, onContactChange]);

  const [contactErrors, setContactErrors] = useState<Partial<Record<keyof ContactDetails, string>>>({});

  const baseAmount = useMemo(() => extractNumericPrice(service.price), [service.price]);
  const finalAmount = discountValidation?.finalAmount ?? baseAmount;
  const amountDueToday = paymentType === 'deposit' ? finalAmount * 0.5 : finalAmount;
  const balanceDue = paymentType === 'deposit' ? Number(Math.max(0, finalAmount - amountDueToday).toFixed(2)) : 0;

  useEffect(() => {
    if (paymentType !== 'deposit') {
      setDepositAcknowledged(false);
    }
  }, [paymentType]);

  const validateContactDetails = useCallback(() => {
    const errors: Partial<Record<keyof ContactDetails, string>> = {};
    if (!hasFirstAndLastName(contactDetails.name)) {
      errors.name = 'Enter first and last name';
    }
    if (!isValidEmail(contactDetails.email)) {
      errors.email = 'Enter a valid email';
    }
    if (!isValidPhoneDisplay(contactDetails.phone)) {
      errors.phone = 'Enter a valid phone number';
    }
    setContactErrors(errors);
    return Object.keys(errors).length === 0;
  }, [contactDetails]);

  const contactInfoReady = useMemo(
    () =>
      hasFirstAndLastName(contactDetails.name) &&
      isValidEmail(contactDetails.email) &&
      isValidPhoneDisplay(contactDetails.phone),
    [contactDetails]
  );

  const validateDiscount = useCallback(async () => {
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
        setDiscountValidation({
          valid: false,
          discountAmount: 0,
          finalAmount: baseAmount,
          originalAmount: baseAmount,
        });
        setError(data.error || 'Invalid discount code');
      }
    } catch {
      setError('Failed to validate discount code');
      setDiscountValidation(null);
    } finally {
      setValidatingDiscount(false);
    }
  }, [discountCode, baseAmount]);

  const handlePayment = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
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

      const trimmedContact: ContactDetails = {
        name: contactDetails.name.trim(),
        email: contactDetails.email.trim(),
        phone: normalizePhoneForSubmit(contactDetails.phone),
        notes: contactDetails.notes.trim(),
      };

      if (!pendingBooking?.hapioBookingId) {
        setError('Unable to locate booking reference. Please close and reselect your time.');
        return;
      }

      setProcessing(true);
      setError(null);

      try {
        const intentResponse = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: deriveServiceSlug(service),
            serviceName: service.name,
            amount: baseAmount,
            discountCode: discountValidation?.valid ? discountCode.toUpperCase() : null,
            paymentType,
            depositPercent: 50,
            clientName: trimmedContact.name,
            clientEmail: trimmedContact.email,
            clientPhone: trimmedContact.phone,
            clientNotes: trimmedContact.notes,
            hapioBookingId: pendingBooking.hapioBookingId,
          }),
        });

        if (!intentResponse.ok) {
          const errorData = await intentResponse.json();
          throw new Error(errorData.error || 'Failed to create payment intent');
        }

        const intentJson = await intentResponse.json();
        const { clientSecret, paymentIntentId, amount: amountCharged } = intentJson;

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

        if (
          paymentIntent?.status === 'succeeded' ||
          paymentIntent?.status === 'requires_capture' ||
          paymentIntent?.status === 'processing'
        ) {
          setSuccess(true);
          onSuccess({
            paymentIntentId,
            paymentType,
            amountPaid: typeof amountCharged === 'number' ? amountCharged : amountDueToday,
            discountCode: discountValidation?.valid ? discountCode.toUpperCase() : undefined,
            contact: trimmedContact,
          });
        } else {
          throw new Error(`Payment status: ${paymentIntent?.status}. Please try again.`);
        }
      } catch (err: any) {
        setError(err.message || 'Payment failed. Please try again.');
      } finally {
        setProcessing(false);
      }
    },
    [
      stripe,
      elements,
      validateContactDetails,
      paymentType,
      depositAcknowledged,
      contactDetails,
      service,
      baseAmount,
      discountValidation,
      discountCode,
      amountDueToday,
      pendingBooking,
      onSuccess,
    ]
  );

  const disableSubmit =
    processing ||
    success ||
    !stripe ||
    !cardComplete ||
    !contactInfoReady ||
    (paymentType === 'deposit' && !depositAcknowledged) ||
    !pendingBooking?.hapioBookingId;

  return (
    <form onSubmit={handlePayment} className="space-y-6">
      <div className="border border-sand rounded-lg p-4 bg-white space-y-4">
        <h3 className="font-serif text-lg text-charcoal">Your Information</h3>
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
              className="w-full px-3 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
              disabled={processing || success}
            />
            {contactErrors.name && <p className="text-xs text-red-600 mt-1">{contactErrors.name}</p>}
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
              className="w-full px-3 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
              disabled={processing || success}
            />
            {contactErrors.email && <p className="text-xs text-red-600 mt-1">{contactErrors.email}</p>}
          </div>
        </div>

        <div className="grid gap-3 md:gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-charcoal mb-1" htmlFor="booking-phone">
              Phone Number
            </label>
            <input
              id="booking-phone"
              type="tel"
              value={contactDetails.phone}
              onChange={(event) => {
                setContactDetails((prev) => ({
                  ...prev,
                  phone: formatPhoneInput(event.target.value),
                }));
                setContactErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              onBlur={validateContactDetails}
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
              disabled={processing || success}
            />
            {contactErrors.phone && <p className="text-xs text-red-600 mt-1">{contactErrors.phone}</p>}
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
              className="w-full px-3 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage resize-none text-sm"
              disabled={processing || success}
            />
          </div>
        </div>
      </div>

      <div className="border border-sand rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-charcoal mb-2">
            Discount Code (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={discountCode}
              onChange={(event) => {
                setDiscountCode(event.target.value.toUpperCase());
                setDiscountValidation(null);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (discountCode.trim() && !processing && !validatingDiscount) {
                    void validateDiscount();
                  }
                }
              }}
              placeholder="Enter code"
              className="flex-1 px-3 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
              disabled={processing || validatingDiscount || success}
            />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void validateDiscount();
              }}
              disabled={processing || validatingDiscount || !discountCode.trim() || success}
              className="px-4 py-2 bg-dark-sage text-charcoal rounded-lg font-medium text-sm hover:bg-sage-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

        <div className="space-y-2">
          <label className="block text-xs sm:text-sm font-medium text-charcoal mb-2">
            Payment Option
          </label>
          <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-sand/20 transition-colors">
            <input
              type="radio"
              name="paymentType"
              value="full"
              checked={paymentType === 'full'}
              onChange={(event) => setPaymentType(event.target.value as PaymentType)}
              className="mr-2.5"
              disabled={processing || success}
            />
            <div className="flex-1">
              <div className="font-medium text-charcoal">Pay Full Amount</div>
              <div className="text-sm text-warm-gray">${finalAmount.toFixed(2)}</div>
            </div>
          </label>
          <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-sand/20 transition-colors">
            <input
              type="radio"
              name="paymentType"
              value="deposit"
              checked={paymentType === 'deposit'}
              onChange={(event) => setPaymentType(event.target.value as PaymentType)}
              className="mr-2.5"
              disabled={processing || success}
            />
            <div className="flex-1">
              <div className="font-medium text-charcoal">Pay 50% Deposit</div>
              <div className="text-sm text-warm-gray">
                ${(finalAmount * 0.5).toFixed(2)} now, remainder later
              </div>
            </div>
          </label>
          {paymentType === 'deposit' && (
            <div className="mt-3 flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              <input
                id="deposit-ack"
                type="checkbox"
                checked={depositAcknowledged}
                onChange={(event) => setDepositAcknowledged(event.target.checked)}
                className="mt-1"
                disabled={processing || success}
              />
              <label htmlFor="deposit-ack" className="text-xs text-yellow-700 leading-relaxed">
                I understand the remaining balance will be due at the start of my appointment.
              </label>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-charcoal mb-2">
            Card Information
          </label>
          <div className="p-3 border border-sage-dark rounded-lg bg-white">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#3F3A37',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    '::placeholder': { color: '#9CA3AF' },
                  },
                  invalid: { color: '#EF4444', iconColor: '#EF4444' },
                },
              }}
              onChange={(event) => setCardComplete(event.complete)}
            />
          </div>
        </div>

        <div className="bg-dark-sage/10 p-3 rounded-lg space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-medium text-charcoal text-sm">
              {paymentType === 'deposit' ? 'Deposit Due Today' : 'Total Amount'}
            </span>
            <span className="text-xl font-serif font-bold text-charcoal">
              ${amountDueToday.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-warm-gray">
            Original: ${baseAmount.toFixed(2)}
            {discountValidation?.valid && (
              <>
                <span className="mx-1">-</span>
                <span className="text-green-600">
                  Discount: ${discountValidation.discountAmount.toFixed(2)}
                </span>
              </>
            )}
          </div>
          {paymentType === 'deposit' && (
            <div className="text-xs text-warm-gray">
              Balance due at appointment: ${balanceDue.toFixed(2)}
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} />
            Payment successful! Scheduler unlocking…
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            tooltip={processing ? 'Processing payment' : undefined}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            variant={disableSubmit ? 'disabled' : 'primary'}
            tooltip={
              disableSubmit && !success
                ? !cardComplete
                  ? 'Enter your card details'
                  : !contactInfoReady
                  ? 'Complete your contact info'
                  : paymentType === 'deposit' && !depositAcknowledged
                  ? 'Acknowledge the remaining balance'
                  : undefined
                : undefined
            }
          >
            {processing ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Processing…
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="mr-2" size={18} />
                Success
              </>
            ) : paymentType === 'deposit' ? (
              `Pay Deposit $${amountDueToday.toFixed(2)}`
            ) : (
              `Pay $${amountDueToday.toFixed(2)}`
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

interface CustomPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: (ServiceSummary & { summary: string; description?: string }) | null;
  selectedSlot: SelectedSlot | null;
  pendingBooking: PendingBooking | null;
}

export default function CustomPaymentModal({
  isOpen,
  onClose,
  service,
  selectedSlot,
  pendingBooking,
}: CustomPaymentModalProps) {
  useBodyScrollLock(isOpen);

  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessPayload | null>(null);
  const [contactPrefill, setContactPrefill] = useState<ContactDetails | null>(null);

  const serviceSlug = deriveServiceSlug(service);
  const primaryPhoto = useMemo(() => {
    if (!service?.slug) return null;
    const photos = getServicePhotoPaths(service.slug);
    return photos.length > 0 ? photos[0] : null;
  }, [service?.slug]);

      if (details.notes.trim()) prefillPayload.notes = details.notes.trim();
  const handlePaymentSuccess = useCallback((payload: PaymentSuccessPayload) => {
    setPaymentSuccess(payload);
    setContactPrefill(payload.contact);
  }, []);

  const handleClose = useCallback(() => {
    setPaymentSuccess(null);
    setContactPrefill(null);
    onClose();
  }, [onClose]);

  const slotSummary = useMemo(() => {
    if (!selectedSlot) {
      return null;
    }
    const startDate = new Date(selectedSlot.start);
    const endDate = new Date(selectedSlot.end);
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    return {
      date: dateFormatter.format(startDate),
      start: timeFormatter.format(startDate),
      end: timeFormatter.format(endDate),
      resource: selectedSlot.resources?.[0]?.name ?? null,
    };
  }, [selectedSlot]);
  const hapioBookingReference = pendingBooking?.hapioBookingId ?? null;

  if (!service) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="bg-white rounded-lg max-w-6xl w-[min(95vw,1180px)] max-h-[92vh] overflow-y-auto shadow-xl relative px-2 pt-2 pb-6 md:px-4"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 hover:bg-sand/30 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X size={20} className="text-charcoal" />
              </button>

              <div className="px-4 pt-1 pb-5 sm:px-8 sm:pb-8">
                <div className="flex flex-col gap-3 sm:gap-4 mb-5">
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
                        <span>
                          Duration:{' '}
                          <span className="text-charcoal font-medium">{service.duration}</span>
                        </span>
                        <span>
                          Base Price:{' '}
                          <span className="text-charcoal font-medium">{service.price}</span>
                        </span>
                        {slotSummary && (
                          <span>
                            Selected:{' '}
                            <span className="text-charcoal font-medium">
                              {slotSummary.date} · {slotSummary.start} – {slotSummary.end}
                            </span>
                            {slotSummary.resource ? (
                              <span className="text-warm-gray/70"> · with {slotSummary.resource}</span>
                            ) : null}
                          </span>
                        )}
                        {hapioBookingReference && (
                          <span className="text-xs text-warm-gray/80">
                            Hold ID:{' '}
                            <span className="font-mono text-[11px] text-charcoal">
                              {hapioBookingReference}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-warm-gray">
                        Complete your payment to finalize your appointment. Your selected time stays reserved while you pay.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
                  <div className="space-y-6">
                    {!paymentSuccess ? (
                      <Elements stripe={stripePromise}>
                        <ModernPaymentSection
                          service={service}
                          onSuccess={handlePaymentSuccess}
                          onClose={handleClose}
                          onContactChange={setContactPrefill}
                          pendingBooking={pendingBooking}
                        />
                      </Elements>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-5 text-sm text-charcoal">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-base font-semibold text-charcoal">Payment received</p>
                                <p className="text-sm text-warm-gray">
                                  A confirmation email is on the way. We’ll share all visit details and reminders.
                                </p>
                              </div>
                              <div className="grid gap-2 text-xs sm:text-sm text-charcoal">
                                <span className="font-mono break-all">
                                  Stripe reference: {paymentSuccess.paymentIntentId}
                                </span>
                                {paymentSuccess.discountCode && (
                                  <span>
                                    Discount applied: <span className="font-medium">{paymentSuccess.discountCode}</span>
                                  </span>
                                )}
                                {contactPrefill?.email && (
                                  <span>
                                    Receipt sent to <span className="font-medium">{contactPrefill.email}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border border-sand bg-white px-4 py-4 text-sm text-charcoal">
                          <h4 className="font-semibold text-charcoal mb-2">Appointment summary</h4>
                          <ul className="space-y-1">
                            <li>
                              <span className="text-warm-gray">Service:</span>{' '}
                              <span className="font-medium">{service.name}</span>
                            </li>
                            {slotSummary && (
                              <li>
                                <span className="text-warm-gray">When:</span>{' '}
                                <span className="font-medium">
                                  {slotSummary.date} · {slotSummary.start}–{slotSummary.end}
                                </span>
                              </li>
                            )}
                            {hapioBookingReference && (
                              <li>
                                <span className="text-warm-gray">Hapio booking:</span>{' '}
                                <span className="font-mono text-xs">{hapioBookingReference}</span>
                              </li>
                            )}
                            <li>
                              <span className="text-warm-gray">Amount paid:</span>{' '}
                              <span className="font-medium">
                                $
                                {paymentSuccess.amountPaid.toFixed(2)}
                                {paymentSuccess.paymentType === 'deposit' ? ' (deposit)' : ''}
                              </span>
                            </li>
                          </ul>
                        </div>

                        <Button onClick={handleClose} className="w-full">
                          Done
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="border border-sand rounded-lg bg-white overflow-hidden flex flex-col">
                    {primaryPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryPhoto}
                        alt={service.name}
                        className="h-48 w-full object-cover object-center"
                      />
                    ) : (
                      <div className="h-48 w-full bg-gradient-to-br from-dark-sage/40 via-sand/30 to-ivory flex items-center justify-center">
                        <span className="text-4xl opacity-40">✨</span>
                      </div>
                    )}
                    <div className="p-5 space-y-4">
                      <div>
                        <h4 className="text-lg font-serif text-charcoal">{service.name}</h4>
                        <p className="text-sm text-warm-gray leading-relaxed mt-1">{service.summary}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm text-charcoal">
                        <div className="rounded-lg bg-dark-sage/15 px-3 py-2">
                          <span className="text-xs uppercase tracking-wide text-warm-gray">Duration</span>
                          <div className="font-medium">{service.duration}</div>
                        </div>
                        <div className="rounded-lg bg-dark-sage/15 px-3 py-2">
                          <span className="text-xs uppercase tracking-wide text-warm-gray">Price</span>
                          <div className="font-medium">{service.price}</div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-dark-sage/30 bg-dark-sage/10 px-3 py-3 text-sm text-charcoal">
                        {slotSummary ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-warm-gray">Scheduled for</span>
                              <span className="font-medium text-charcoal">{slotSummary.date}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-warm-gray">Time</span>
                              <span className="font-medium text-charcoal">
                                {slotSummary.start} – {slotSummary.end}
                              </span>
                            </div>
                            {slotSummary.resource && (
                              <div className="flex items-center justify-between">
                                <span className="text-warm-gray">Provider</span>
                                <span className="font-medium text-charcoal">{slotSummary.resource}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-warm-gray">
                            Your booking time will appear here once selected.
                          </div>
                        )}
                      </div>

                      {hapioBookingReference && (
                        <div className="text-xs text-warm-gray/80">
                          Booking reference:{' '}
                          <span className="font-mono">{hapioBookingReference}</span>
                        </div>
                      )}

                      {service.description && (
                        <div className="border-t border-sand pt-4 text-sm text-warm-gray leading-relaxed">
                          {service.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

type SelectedSlot = {
  start: string;
  end: string;
  bufferStart?: string | null;
  bufferEnd?: string | null;
  resources: Array<{
    id: string;
    name: string;
    enabled: boolean;
    metadata?: Record<string, unknown> | null;
  }>;
};

type PendingBooking = {
  hapioBookingId: string;
  serviceId: string;
  locationId: string;
  resourceId: string | null;
  startsAt: string;
  endsAt: string;
  isTemporary: boolean;
  timezone: string | null;
};


