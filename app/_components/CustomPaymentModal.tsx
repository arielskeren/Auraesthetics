'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

import Button from './Button';
import { useBodyScrollLock } from '../_hooks/useBodyScrollLock';
import { useCalEmbed, extractCalLink } from '../_hooks/useCalEmbed';
import { getServicePhotoPaths } from '../_utils/servicePhotos';
import { getCalEmbedConfigBySlug } from '@/lib/calEventMapping';

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
  calBookingUrl?: string | null;
}

interface ModernPaymentSectionProps {
  service: ServiceSummary;
  onClose: () => void;
  onSuccess: (payload: PaymentSuccessPayload) => void;
  onContactChange: (contact: ContactDetails) => void;
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
  if (service.calBookingUrl) {
    try {
      const url = new URL(service.calBookingUrl);
      const segments = url.pathname.split('/').filter(Boolean);
      const slugFromUrl = segments.pop();
      if (slugFromUrl) {
        return slugFromUrl;
      }
    } catch {
      // fall through
    }
  }
  return service.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
}

function extractNumericPrice(priceString: string): number {
  const match = priceString.match(/\$?(\d+(\.\d{1,2})?)/);
  return match ? parseFloat(match[1]) : 0;
}

function ModernPaymentSection({ service, onSuccess, onClose, onContactChange }: ModernPaymentSectionProps) {
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
      onSuccess,
    ]
  );

  const disableSubmit =
    processing ||
    success ||
    !stripe ||
    !cardComplete ||
    !contactInfoReady ||
    (paymentType === 'deposit' && !depositAcknowledged);

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
}

export default function CustomPaymentModal({ isOpen, onClose, service }: CustomPaymentModalProps) {
  useBodyScrollLock(isOpen);
  useCalEmbed();

  const [paymentUnlocked, setPaymentUnlocked] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessPayload | null>(null);
  const [hasMountedCal, setHasMountedCal] = useState(false);
  const [contactPrefill, setContactPrefill] = useState<ContactDetails | null>(null);

  const serviceSlug = deriveServiceSlug(service);
  const primaryPhoto = useMemo(() => {
    if (!service?.slug) return null;
    const photos = getServicePhotoPaths(service.slug);
    return photos.length > 0 ? photos[0] : null;
  }, [service?.slug]);

  const embedConfig = useMemo(
    () => (serviceSlug ? getCalEmbedConfigBySlug(serviceSlug) : null),
    [serviceSlug]
  );

  const namespace = embedConfig?.namespace ?? serviceSlug ?? 'booking';
  const inlineElementId = embedConfig?.elementId ?? `cal-inline-${namespace}`;
  const calLink = embedConfig?.calLink ?? (service?.calBookingUrl ? extractCalLink(service.calBookingUrl) : null);
  const inlineConfig = useMemo(
    () =>
      embedConfig?.inlineConfig ?? {
        layout: 'column_view',
        theme: 'light',
      },
    [embedConfig]
  );
  const uiConfig = useMemo(
    () =>
      embedConfig?.uiConfig ?? {
        theme: 'light',
        hideEventTypeDetails: false,
        layout: 'column_view',
      },
    [embedConfig]
  );

  useEffect(() => {
    if (!isOpen) {
      setPaymentUnlocked(false);
      setPaymentSuccess(null);
      setHasMountedCal(false);
      setContactPrefill(null);
      const container = document.getElementById(inlineElementId);
      if (container) {
        container.innerHTML = '';
      }
    }
  }, [isOpen, inlineElementId]);

  useEffect(() => {
    if (!isOpen || !calLink) {
      return;
    }

    const container = document.getElementById(inlineElementId);
    if (container) {
      container.innerHTML = '';
    }

    const mount = () => {
      if (!window.Cal) {
        return false;
      }

      try {
        window.Cal('config', { forwardQueryParams: true });
      } catch {
        // ignore
      }

      try {
        window.Cal('init', namespace, { origin: 'https://app.cal.com' });
      } catch {
        // continue even if namespace init fails
      }

      const mountInline = () => {
        try {
          if (window.Cal?.ns?.[namespace]) {
            window.Cal.ns[namespace]('inline', {
              elementOrSelector: `#${inlineElementId}`,
              calLink,
              config: inlineConfig,
            });
            window.Cal.ns[namespace]('ui', uiConfig);
          } else {
            window.Cal('inline', {
              elementOrSelector: `#${inlineElementId}`,
              calLink,
              config: inlineConfig,
            });
            window.Cal('ui', uiConfig);
          }
          setHasMountedCal(true);
          return true;
        } catch (error) {
          console.error('Failed to initialize Cal inline embed', error);
          return false;
        }
      };

      if (mountInline()) {
        return true;
      }
      return false;
    };

    if (mount()) {
      return;
    }

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      if (mount() || attempts > 25) {
        window.clearInterval(interval);
      }
    }, 150);

    return () => window.clearInterval(interval);
  }, [isOpen, calLink, inlineElementId, namespace, inlineConfig, uiConfig]);

  const applyCalPrefill = useCallback(
    (details: ContactDetails | null) => {
      if (!details || typeof window === 'undefined') {
        return;
      }
      const formattedPhone = normalizePhoneForSubmit(details.phone);
      const prefillPayload: Record<string, string> = {};
      if (details.name.trim()) prefillPayload.name = details.name.trim();
      if (details.email.trim()) prefillPayload.email = details.email.trim();
      if (formattedPhone.trim()) prefillPayload.smsReminderNumber = formattedPhone;
      if (details.notes.trim()) prefillPayload.notes = details.notes.trim();

      if (Object.keys(prefillPayload).length === 0) {
        return;
      }

      try {
        window.Cal?.('config', { prefill: prefillPayload });
      } catch (error) {
        console.warn('Cal config prefill failed', error);
      }

      if (namespace && window.Cal?.ns?.[namespace]) {
        try {
          window.Cal.ns[namespace]('prefill', prefillPayload);
        } catch (error) {
          console.warn('Cal namespace prefill failed', error);
        }
      }
    },
    [namespace]
  );

  useEffect(() => {
    if (!paymentUnlocked) {
      return;
    }
    applyCalPrefill(contactPrefill);
  }, [paymentUnlocked, contactPrefill, applyCalPrefill]);

  const handlePaymentSuccess = useCallback((payload: PaymentSuccessPayload) => {
    setPaymentSuccess(payload);
    setPaymentUnlocked(true);
    setContactPrefill(payload.contact);
  }, []);

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
                        <span>Duration: <span className="text-charcoal font-medium">{service.duration}</span></span>
                        <span>Base Price: <span className="text-charcoal font-medium">{service.price}</span></span>
                      </div>
                      <p className="text-xs sm:text-sm text-warm-gray">
                        Complete your payment to unlock the scheduler instantly.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
                  <div className="space-y-6">
                    <Elements stripe={stripePromise}>
                      <ModernPaymentSection
                        service={service}
                        onSuccess={handlePaymentSuccess}
                        onClose={onClose}
                        onContactChange={setContactPrefill}
                      />
                    </Elements>

                    {paymentSuccess && (
                      <div className="rounded-lg border border-dark-sage/30 bg-dark-sage/10 px-4 py-3 text-sm text-charcoal">
                        <p className="font-medium text-dark-sage">Payment confirmed.</p>
                        <p>
                          Reference:{' '}
                          <span className="font-mono text-xs">{paymentSuccess.paymentIntentId}</span>
                          {paymentSuccess.discountCode ? ` · Discount: ${paymentSuccess.discountCode}` : null}
                        </p>
                        <p className="text-xs text-warm-gray mt-1">
                          Your details have been passed to the scheduler. Choose a time on the right.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="relative border border-sand rounded-lg bg-white overflow-hidden min-h-[640px]">
                    <div
                      id={inlineElementId}
                      className="min-h-[640px] bg-white"
                    >
                      {!calLink && (
                        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-warm-gray">
                          The Cal.com scheduler for this service is not yet configured. We will reach out after payment
                          to confirm your appointment time.
                        </div>
                      )}
                    </div>

                    {calLink && !paymentUnlocked && (
                      <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center px-6">
                        <div className="w-12 h-12 rounded-full bg-dark-sage/15 flex items-center justify-center">
                          <Lock className="text-dark-sage" size={24} />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-charcoal">
                            Complete payment to unlock scheduling
                          </p>
                          <p className="text-sm text-warm-gray mt-1">
                            Once payment succeeds, the scheduler unlocks automatically—no refresh required.
                          </p>
                          {!hasMountedCal && (
                            <p className="text-xs text-warm-gray/80 mt-2">
                              Loading the live scheduler…
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {calLink && paymentUnlocked && (
                      <div className="absolute inset-x-0 top-0">
                        <div className="mx-4 mt-4 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-700 shadow-sm">
                          Scheduler unlocked — pick your appointment time to finalize booking.
                        </div>
                      </div>
                    )}
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


