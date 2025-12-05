'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertCircle, CreditCard, Lock } from 'lucide-react';
import Script from 'next/script';

import Button from './Button';
import { useBodyScrollLock } from '../_hooks/useBodyScrollLock';

// Declare CollectJS global type
declare global {
  interface Window {
    CollectJS?: {
      configure: (config: CollectJSConfig) => void;
      startPaymentRequest: () => void;
    };
  }
}

interface CollectJSConfig {
  variant: 'inline';
  paymentSelector?: string;
  paymentType?: 'cc';
  callback: (response: CollectJSResponse) => void;
  validationCallback?: (field: string, valid: boolean, message: string) => void;
  timeoutDuration?: number;
  timeoutCallback?: () => void;
  fieldsAvailableCallback?: () => void;
  customCss?: Record<string, string>;
  focusCss?: Record<string, string>;
  invalidCss?: Record<string, string>;
  validCss?: Record<string, string>;
  placeholderCss?: Record<string, string>;
  fields?: {
    ccnumber?: { placeholder?: string };
    ccexp?: { placeholder?: string };
    cvv?: { placeholder?: string };
  };
}

interface CollectJSResponse {
  token?: string;
  card?: {
    number?: string;
    type?: string;
    exp?: string;
    bin?: string;
    hash?: string;
  };
  check?: any;
  wallet?: any;
}

type PaymentType = 'full' | 'deposit';

interface ContactDetails {
  firstName: string;
  lastName: string;
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
  image_url?: string | null;
}

interface PaymentSuccessPayload {
  transactionId: string;
  paymentType: PaymentType;
  amountPaid: number;
  discountCode?: string;
  contact: ContactDetails;
}

interface ModernPaymentSectionProps {
  service: ServiceSummary & { summary: string; category: string };
  onClose: () => void;
  onSuccess: (payload: PaymentSuccessPayload) => void;
  onContactChange: (contact: ContactDetails) => void;
  pendingBooking: PendingBooking | null;
  primaryPhoto: string | null;
  slotSummary: {
    date: string;
    start: string;
    end: string;
    resource: string | null;
  } | null;
  hapioBookingReference: string | null;
  collectJsReady: boolean;
}

// Get tokenization key from environment
const TOKENIZATION_KEY = process.env.NEXT_PUBLIC_MAGICPAY_TOKENIZATION_KEY;

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
  primaryPhoto,
  slotSummary,
  hapioBookingReference,
  collectJsReady,
}: ModernPaymentSectionProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [discountCode, setDiscountCode] = useState('');
  const [discountValidation, setDiscountValidation] = useState<{
    valid: boolean;
    discountAmount: number;
    finalAmount: number;
    originalAmount: number;
    isOneTime?: boolean;
    requiresEmail?: boolean;
  } | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [depositAcknowledged, setDepositAcknowledged] = useState(false);
  
  // Card field states
  const [fieldsReady, setFieldsReady] = useState(false);
  const [cardFieldsValid, setCardFieldsValid] = useState({
    ccnumber: false,
    ccexp: false,
    cvv: false,
  });
  const [cardFieldErrors, setCardFieldErrors] = useState<Record<string, string>>({});
  const [paymentToken, setPaymentToken] = useState<string | null>(null);
  
  const [contactDetails, setContactDetails] = useState<ContactDetails>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });
  
  const collectJsConfigured = useRef(false);
  const tokenizationInProgress = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  
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

  // Configure Collect.js when ready
  useEffect(() => {
    if (!collectJsReady || collectJsConfigured.current || !window.CollectJS) {
      return;
    }
    
    collectJsConfigured.current = true;
    
    // Brand colors for Collect.js field styling
    const customCss = {
      'font-family': 'Inter, system-ui, sans-serif',
      'font-size': '16px',
      'color': '#3F3A37',
      'background-color': 'transparent',
      'border': 'none',
      'padding': '0',
      'outline': 'none',
    };
    
    const focusCss = {
      'outline': 'none',
    };
    
    const invalidCss = {
      'color': '#EF4444',
    };
    
    const validCss = {
      'color': '#3F3A37',
    };
    
    const placeholderCss = {
      'color': '#9CA3AF',
    };
    
    window.CollectJS.configure({
      variant: 'inline',
      paymentType: 'cc',
      callback: (response) => {
        tokenizationInProgress.current = false;
        if (response.token) {
          setPaymentToken(response.token);
          // Submit the form programmatically after getting token
          if (formRef.current) {
            formRef.current.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        } else {
          setError('Failed to process card. Please check your details and try again.');
          setProcessing(false);
        }
      },
      validationCallback: (field, valid, message) => {
        setCardFieldsValid(prev => ({ ...prev, [field]: valid }));
        setCardFieldErrors(prev => {
          if (valid) {
            const next = { ...prev };
            delete next[field];
            return next;
          }
          return { ...prev, [field]: message };
        });
      },
      timeoutDuration: 15000,
      timeoutCallback: () => {
        tokenizationInProgress.current = false;
        setError('Payment service timed out. Please check your connection and try again.');
        setProcessing(false);
      },
      fieldsAvailableCallback: () => {
        setFieldsReady(true);
      },
      customCss,
      focusCss,
      invalidCss,
      validCss,
      placeholderCss,
      fields: {
        ccnumber: { placeholder: '4111 1111 1111 1111' },
        ccexp: { placeholder: 'MM/YY' },
        cvv: { placeholder: 'CVV' },
      },
    });
  }, [collectJsReady]);

  const cardComplete = cardFieldsValid.ccnumber && cardFieldsValid.ccexp && cardFieldsValid.cvv;

  const validateContactDetails = useCallback(() => {
    const errors: Partial<Record<keyof ContactDetails, string>> = {};
    if (!contactDetails.firstName.trim()) {
      errors.firstName = 'Enter first name';
    }
    if (!contactDetails.lastName.trim()) {
      errors.lastName = 'Enter last name';
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
      !!contactDetails.firstName.trim() &&
      !!contactDetails.lastName.trim() &&
      isValidEmail(contactDetails.email) &&
      isValidPhoneDisplay(contactDetails.phone),
    [contactDetails]
  );

  const validateDiscount = useCallback(async () => {
    if (!discountCode.trim()) {
      setDiscountValidation(null);
      return;
    }

    if (!contactDetails.email?.trim() || !isValidEmail(contactDetails.email)) {
      setDiscountValidation({
        valid: false,
        discountAmount: 0,
        finalAmount: baseAmount,
        originalAmount: baseAmount,
        isOneTime: false,
        requiresEmail: true,
      });
      setError('Please enter your email address to verify your eligibility for discount codes');
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
          customerEmail: contactDetails.email?.trim() || null,
          customerName: contactDetails.firstName && contactDetails.lastName 
            ? `${contactDetails.firstName.trim()} ${contactDetails.lastName.trim()}`.trim()
            : null,
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
          isOneTime: false,
          requiresEmail: data.requiresEmail || false,
        });
        setError(data.error || 'Invalid discount code');
      }
    } catch {
      setError('Failed to validate discount code');
      setDiscountValidation(null);
    } finally {
      setValidatingDiscount(false);
    }
  }, [discountCode, baseAmount, contactDetails.email, contactDetails.firstName, contactDetails.lastName]);

  const handlePayment = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      
      // If we have a token, submit to backend
      if (paymentToken) {
        if (!validateContactDetails()) {
          setError('Please correct the highlighted contact information.');
          return;
        }

        if (paymentType === 'deposit' && !depositAcknowledged) {
          setError('Please acknowledge that the remaining balance will be due at the appointment.');
          return;
        }

        const trimmedContact: ContactDetails = {
          firstName: contactDetails.firstName.trim(),
          lastName: contactDetails.lastName.trim(),
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
          const chargeResponse = await fetch('/api/magicpay/charge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentToken,
              serviceSlug: service.slug ?? deriveServiceSlug(service),
              slotStart: pendingBooking.startsAt,
              slotEnd: pendingBooking.endsAt,
              timezone: pendingBooking.timezone,
              bookingId: pendingBooking.hapioBookingId,
              amountCents: Math.max(1, Math.round(amountDueToday * 100)),
              discountCode: discountValidation?.valid ? discountCode.toUpperCase() : null,
              customer: trimmedContact,
              paymentType,
            }),
          });

          const chargeResult = await chargeResponse.json();

          if (!chargeResponse.ok || !chargeResult.success) {
            throw new Error(chargeResult.error || 'Payment failed');
          }

          setSuccess(true);
          onSuccess({
            transactionId: chargeResult.transactionId,
            paymentType,
            amountPaid: amountDueToday,
            discountCode: discountValidation?.valid ? discountCode.toUpperCase() : undefined,
            contact: trimmedContact,
          });
        } catch (err: any) {
          setError(err.message || 'Payment failed. Please try again.');
          setPaymentToken(null); // Clear token to allow retry
        } finally {
          setProcessing(false);
        }
        return;
      }
      
      // No token yet - trigger Collect.js tokenization
      if (!fieldsReady || !window.CollectJS) {
        setError('Payment form is not ready. Please wait a moment and try again.');
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

      if (!cardComplete) {
        setError('Please enter valid card details.');
        return;
      }

      if (!pendingBooking?.hapioBookingId) {
        setError('Unable to locate booking reference. Please close and reselect your time.');
        return;
      }

      // Prevent double submission
      if (tokenizationInProgress.current) {
        return;
      }

      tokenizationInProgress.current = true;
      setProcessing(true);
      setError(null);

      // Trigger Collect.js tokenization
      try {
        window.CollectJS!.startPaymentRequest();
      } catch (e) {
        tokenizationInProgress.current = false;
        setError('Failed to start payment process. Please try again.');
        setProcessing(false);
      }
    },
    [
      paymentToken,
      validateContactDetails,
      paymentType,
      depositAcknowledged,
      contactDetails,
      service,
      discountValidation,
      discountCode,
      amountDueToday,
      pendingBooking,
      onSuccess,
      fieldsReady,
      cardComplete,
    ]
  );

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const disableSubmit =
    processing ||
    success ||
    !fieldsReady ||
    !cardComplete ||
    !contactInfoReady ||
    (paymentType === 'deposit' && !depositAcknowledged) ||
    !acceptedTerms ||
    !pendingBooking?.hapioBookingId;

  return (
    <form ref={formRef} onSubmit={handlePayment} className="space-y-4">
      {/* Top Section: Client Info and Service Info */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Client Information */}
        <div className="border border-sand rounded-lg p-4 bg-white space-y-4">
          <h3 className="font-serif text-lg text-charcoal">Your Information</h3>
          <div className="grid gap-3 md:gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-charcoal mb-1" htmlFor="booking-first-name">
                First Name
              </label>
              <input
                id="booking-first-name"
                type="text"
                value={contactDetails.firstName}
                onChange={(event) => {
                  setContactDetails((prev) => ({ ...prev, firstName: event.target.value }));
                  setContactErrors((prev) => ({ ...prev, firstName: undefined }));
                }}
                onBlur={validateContactDetails}
                placeholder="Jane"
                className="w-full px-3 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                disabled={processing || success}
              />
              {contactErrors.firstName && <p className="text-xs text-red-600 mt-1">{contactErrors.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-charcoal mb-1" htmlFor="booking-last-name">
                Last Name
              </label>
              <input
                id="booking-last-name"
                type="text"
                value={contactDetails.lastName}
                onChange={(event) => {
                  setContactDetails((prev) => ({ ...prev, lastName: event.target.value }));
                  setContactErrors((prev) => ({ ...prev, lastName: undefined }));
                }}
                onBlur={validateContactDetails}
                placeholder="Doe"
                className="w-full px-3 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                disabled={processing || success}
              />
              {contactErrors.lastName && <p className="text-xs text-red-600 mt-1">{contactErrors.lastName}</p>}
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
              rows={4}
              className="w-full px-3 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage resize-none text-sm"
              disabled={processing || success}
            />
          </div>
        </div>

        {/* Right: Service Info */}
        <div className="border border-sand rounded-lg p-4 bg-white space-y-3 flex flex-col">
          {/* Service header with image and details inline */}
          <div className="flex items-start gap-3">
            {/* Small square image */}
            {primaryPhoto ? (
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-sand/40 flex-shrink-0 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={primaryPhoto}
                  alt={service.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-lg bg-sand/60 flex items-center justify-center text-xs text-warm-gray uppercase tracking-wide flex-shrink-0">
                {service.name.slice(0, 2)}
              </div>
            )}
            {/* Service details inline */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block px-2 py-0.5 bg-dark-sage/20 text-dark-sage text-[10px] font-medium rounded-full">
                  {service.category}
                </span>
              </div>
              <h4 className="text-base font-serif text-charcoal mb-1">{service.name}</h4>
              <p className="text-xs text-warm-gray mb-2 line-clamp-2">{service.summary}</p>
              <div className="flex items-center gap-3 text-xs text-charcoal">
                <span className="font-medium">{service.duration}</span>
                <span className="text-warm-gray">•</span>
                <span className="font-medium">{service.price}</span>
              </div>
            </div>
          </div>

          {/* Booking details below */}
          {slotSummary && (
            <div className="border-t border-sand pt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-warm-gray">Scheduled for</span>
                <span className="font-medium text-charcoal">{slotSummary.date}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-warm-gray">Time</span>
                <span className="font-medium text-charcoal">
                  {slotSummary.start} – {slotSummary.end}
                </span>
              </div>
              {slotSummary.resource && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-warm-gray">Provider</span>
                  <span className="font-medium text-charcoal">{slotSummary.resource}</span>
                </div>
              )}
            </div>
          )}

          {/* Reference number at bottom, away from everything */}
          {hapioBookingReference && (
            <div className="border-t border-sand pt-3 mt-auto">
              <div className="text-[10px] text-warm-gray/60 text-left break-words overflow-wrap-anywhere">
                Ref: <span className="font-mono">{hapioBookingReference}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Payment Info */}
      <div className="border border-sand rounded-lg p-4 bg-white space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: Discount Code, Payment Option, and Card Information */}
          <div className="space-y-4">
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
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={16} />
                    Discount applied! ${discountValidation.discountAmount.toFixed(2)} off
                  </p>
                  {discountValidation.isOneTime && !contactDetails.email?.trim() && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                      Please enter your email address to verify your eligibility for this discount code.
                    </p>
                  )}
                </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <div className="text-xs text-warm-gray">${finalAmount.toFixed(2)} due now</div>
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
                    <div className="text-xs text-warm-gray">${(finalAmount * 0.5).toFixed(2)} due now</div>
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
                    disabled={processing || success}
                  />
                  <label htmlFor="deposit-ack" className="text-xs text-yellow-700 leading-relaxed">
                    I understand the remaining balance will be due at the start of my appointment.
                  </label>
                </div>
              )}
            </div>

            {/* Card Information - Collect.js Inline Fields */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-charcoal mb-2">
                <span className="flex items-center gap-2">
                  <CreditCard size={16} />
                  Card Information
                  <Lock size={12} className="text-green-600" />
                </span>
              </label>
              
              {!fieldsReady && (
                <div className="p-4 border border-sage-dark rounded-lg bg-sand/10 flex items-center justify-center gap-2 text-sm text-warm-gray">
                  <Loader2 className="animate-spin" size={16} />
                  Loading secure payment fields...
                </div>
              )}
              
              <div className={`space-y-3 ${!fieldsReady ? 'hidden' : ''}`}>
                {/* Card Number */}
                <div>
                  <div 
                    id="ccnumber" 
                    className={`p-3 border rounded-lg bg-white min-h-[44px] ${
                      cardFieldErrors.ccnumber ? 'border-red-400' : 'border-sage-dark'
                    } focus-within:ring-2 focus-within:ring-dark-sage`}
                  />
                  {cardFieldErrors.ccnumber && (
                    <p className="text-xs text-red-600 mt-1">{cardFieldErrors.ccnumber}</p>
                  )}
                </div>
                
                {/* Exp and CVV side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div 
                      id="ccexp" 
                      className={`p-3 border rounded-lg bg-white min-h-[44px] ${
                        cardFieldErrors.ccexp ? 'border-red-400' : 'border-sage-dark'
                      } focus-within:ring-2 focus-within:ring-dark-sage`}
                    />
                    {cardFieldErrors.ccexp && (
                      <p className="text-xs text-red-600 mt-1">{cardFieldErrors.ccexp}</p>
                    )}
                  </div>
                  <div>
                    <div 
                      id="cvv" 
                      className={`p-3 border rounded-lg bg-white min-h-[44px] ${
                        cardFieldErrors.cvv ? 'border-red-400' : 'border-sage-dark'
                      } focus-within:ring-2 focus-within:ring-dark-sage`}
                    />
                    {cardFieldErrors.cvv && (
                      <p className="text-xs text-red-600 mt-1">{cardFieldErrors.cvv}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <p className="text-[10px] text-warm-gray/70 mt-2 flex items-center gap-1">
                <Lock size={10} />
                Your card details are securely processed. We never store your card number.
              </p>
            </div>
          </div>

          {/* Right: Total Amount, Terms, and Buttons */}
          <div className="space-y-4">

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

            <div className="bg-sand/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <input
                  id="terms-accept"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1"
                  disabled={processing || success}
                />
                <label htmlFor="terms-accept" className="text-xs text-charcoal leading-relaxed">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTermsModal(true);
                    }}
                    className="text-dark-sage hover:text-sage-dark underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-dark-sage rounded"
                    disabled={processing || success}
                  >
                    I agree to the Booking, Cancellation, Refund, Communication &amp; Payment Authorization Terms
                  </button>
                </label>
              </div>
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
                Payment successful! Your appointment is confirmed.
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
                    ? !fieldsReady
                      ? 'Loading payment fields...'
                      : !cardComplete
                      ? 'Enter your card details'
                      : !contactInfoReady
                      ? 'Complete your contact info'
                      : paymentType === 'deposit' && !depositAcknowledged
                      ? 'Acknowledge the remaining balance'
                      : !acceptedTerms
                      ? 'Accept the terms to continue'
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
        </div>
      </div>

      {/* Terms Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-[70]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTermsModal(false)}
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div
                className="bg-white rounded-lg max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-xl relative"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="absolute top-4 right-4 z-10 p-2 hover:bg-sand/30 rounded-full transition-colors"
                  aria-label="Close modal"
                >
                  <X size={20} className="text-charcoal" />
                </button>
                <div className="overflow-y-auto max-h-[85vh]">
                  <div className="p-8">
                    <h3 className="text-2xl font-serif text-charcoal mb-6">
                      Booking, Cancellation, Refund, Communication &amp; Payment Authorization Terms
                    </h3>
                    <div className="text-sm text-warm-gray leading-relaxed space-y-4">
                      <p>
                        By scheduling or completing a booking with Auraesthetics (&quot;we,&quot; &quot;our,&quot; &quot;us&quot;), you acknowledge and agree to the following terms:
                      </p>
                      <div>
                        <h4 className="font-semibold text-charcoal mb-2">1. Appointment Policies</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>You must provide at least 24 hours&apos; notice to reschedule or cancel an appointment.</li>
                          <li>Late cancellations or no-shows may result in a fee or forfeiture of any required deposit.</li>
                          <li>We reserve the right to refuse or discontinue service at our discretion.</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-charcoal mb-2">2. Nature of Services</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>All services are cosmetic and wellness-oriented.</li>
                          <li>Services do not constitute medical diagnosis, medical treatment, or medical advice.</li>
                          <li>No outcome is guaranteed, and individual results vary.</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-charcoal mb-2">3. Payments &amp; Authorization</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>By completing your booking, you authorize Auraesthetics to charge your card for the selected service, deposit, or any applicable cancellation/no-show fees in accordance with these terms.</li>
                          <li>For deposits, the remaining balance (if any) is due at the time of service unless otherwise stated.</li>
                          <li>Refunds, when granted, are issued back to the original form of payment. Processing time may vary by bank or payment provider.</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-charcoal mb-2">4. Refund Policy</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Deposits may be non-refundable if you cancel late or do not show up.</li>
                          <li>Full refunds are not guaranteed and are issued only at our discretion based on the circumstances and these policies.</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-charcoal mb-2">5. Communications Consent</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>By booking, you consent to receive appointment reminders, service-related notifications, and promotional communications from Auraesthetics via email or SMS.</li>
                          <li>You may opt out of promotional messages at any time.</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-charcoal mb-2">6. Liability &amp; Compliance</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>You agree to provide accurate information and to follow pre- and post-care instructions as directed.</li>
                          <li>Auraesthetics is not responsible for adverse reactions resulting from undisclosed conditions, allergies, or failure to follow care instructions.</li>
                          <li>All policies are applied in accordance with Florida law.</li>
                          <li>Your use of our services constitutes acceptance of these terms.</li>
                        </ul>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={() => setShowTermsModal(false)}
                        variant="primary"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
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
  const [collectJsReady, setCollectJsReady] = useState(false);

  // ONLY use image_url from blob storage - no fallback to public folder
  const primaryPhoto = useMemo(() => {
    return service?.image_url || null;
  }, [service?.image_url]);

  const handlePaymentSuccess = useCallback((payload: PaymentSuccessPayload) => {
    setPaymentSuccess(payload);
    setContactPrefill(payload.contact);
    // Note: The charge endpoint handles all finalization now
  }, []);

  const handleClose = useCallback(() => {
    setPaymentSuccess(null);
    setContactPrefill(null);
    setCollectJsReady(false);
    onClose();
  }, [onClose]);

  const slotSummary = useMemo(() => {
    if (!selectedSlot) {
      return null;
    }
    const startDate = new Date(selectedSlot.start);
    const endDate = new Date(selectedSlot.end);
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
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
          {/* Load Collect.js script */}
          {TOKENIZATION_KEY && (
            <Script
              src="https://secure.magicpaygateway.com/token/Collect.js"
              data-tokenization-key={TOKENIZATION_KEY}
              data-variant="inline"
              onReady={() => setCollectJsReady(true)}
              onError={() => console.error('Failed to load Collect.js')}
            />
          )}
          
          <motion.div
            className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="bg-white rounded-lg max-w-5xl w-[min(95vw,900px)] max-h-[92vh] overflow-y-auto shadow-xl relative px-2 pt-2 pb-6 md:px-4"
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

              <div className="px-4 pt-6 pb-5 sm:px-8 sm:pb-8">
                {!paymentSuccess ? (
                  <ModernPaymentSection
                    service={service}
                    onSuccess={handlePaymentSuccess}
                    onClose={handleClose}
                    onContactChange={setContactPrefill}
                    pendingBooking={pendingBooking}
                    primaryPhoto={primaryPhoto}
                    slotSummary={slotSummary}
                    hapioBookingReference={hapioBookingReference}
                    collectJsReady={collectJsReady}
                  />
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
                              A confirmation email is on the way. We&apos;ll share all visit details and reminders.
                            </p>
                          </div>
                          <div className="grid gap-2 text-xs sm:text-sm text-charcoal">
                            <span className="font-mono break-all">
                              Payment reference: {paymentSuccess.transactionId}
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
                            <span className="text-warm-gray">Booking reference:</span>{' '}
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
