'use client';

import { FormEvent, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationDialog from './ConfirmationDialog';

/**
 * TODO: Future Integration for 15% Off Automatic Application
 * 
 * When Cal.com + Stripe integration is complete:
 * 1. Store signup date in Brevo contact attributes (timestamp when user submitted this form)
 * 2. When user books through Cal.com, check their signup date in Brevo via API
 * 3. If signup date is within 3 months:
 *    - Check if they've used the discount before (track in Brevo custom attribute)
 *    - Apply 15% discount (capped at $30) via Stripe Coupon API
 *    - Mark discount as "used" in Brevo
 * 4. If over 3 months or already used: Show error message
 * 
 * Key Integration Points:
 * - Brevo API: Retrieve contact by email, check signup date and discount status
 * - Stripe API: Create/apply discount code or coupon
 * - Cal.com API: Pass discount code to booking session
 */

interface EmailCaptureProps {
  title?: string;
  description?: string;
  includeSMS?: boolean;
  showCloseLink?: boolean;
  onCloseLinkClick?: () => void;
  isWelcomeOffer?: boolean;
  onCloseOffer?: (confirmed: boolean) => void;
  onSuccess?: () => void;
  signupSource?: string;
  includeAddressAndBirthday?: boolean;
  showThankYouMessage?: boolean;
}

export default function EmailCapture({ 
  title = "Welcome Offer",
  description = "Join our exclusive mailing list and get 15% off your first service",
  includeSMS = true,
  showCloseLink = false,
  onCloseLinkClick,
  isWelcomeOffer = false,
  onCloseOffer,
  onSuccess,
  signupSource = 'footer',
  includeAddressAndBirthday = false,
  showThankYouMessage = false
}: EmailCaptureProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthday, setBirthday] = useState('');
  const [consent, setConsent] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; email?: string; phone?: string; address?: string; birthday?: string; consent?: string }>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const newErrors: { firstName?: string; lastName?: string; email?: string; phone?: string; birthday?: string; consent?: string } = {};
    
    if (!firstName || firstName.trim() === '') {
      newErrors.firstName = 'Please enter your first name';
    }
    
    if (!lastName || lastName.trim() === '') {
      newErrors.lastName = 'Please enter your last name';
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!phone || phone.trim() === '') {
      newErrors.phone = 'Please enter your phone number';
    }
    
    // Birthday is required when includeAddressAndBirthday is true
    if (includeAddressAndBirthday && (!birthday || birthday.trim() === '')) {
      newErrors.birthday = 'Please enter your birthday';
    }
    
    if (!consent) {
      newErrors.consent = 'Please agree to receive updates';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      const payload = { 
        firstName,
        lastName,
        email, 
        phone,
        birthday: includeAddressAndBirthday ? birthday : '',
        address: includeAddressAndBirthday ? address : '',
        signupSource: signupSource,
      };
      
      // Submit to Brevo API
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to subscribe');
      }

      // Clear errors and show success
      setErrors({});
      setShowSuccess(true);
      
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      if (includeAddressAndBirthday) {
        setAddress('');
        setBirthday('');
      }
      setConsent(false);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        if (showThankYouMessage) {
          // For landing page, don't auto-hide, let onSuccess handle it
          // The thank you message will be shown instead
        } else {
          // For other cases, hide after 5 seconds
          setTimeout(() => {
            setShowSuccess(false);
            onSuccess();
          }, 2000);
        }
      } else {
        // Hide success message after 5 seconds if no callback
        setTimeout(() => setShowSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Subscription error:', error);
      setErrors({ email: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {!showSuccess ? (
        <>
          {showThankYouMessage && isWelcomeOffer ? (
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="inline-block bg-gradient-to-r from-dark-sage/20 to-sage-light/20 text-dark-sage px-8 py-3 rounded-full text-base font-bold mb-4"
              >
                🎁 SPECIAL WELCOME OFFER
              </motion.div>
              <h1 className="text-4xl md:text-5xl font-serif text-charcoal mb-4">
                Welcome to Aura Wellness Aesthetics
              </h1>
              <p className="text-warm-gray text-lg leading-relaxed">
                Join our exclusive mailing list and get <span className="text-3xl font-bold text-dark-sage">15% OFF</span> your first service
              </p>
              <p className="text-sm text-warm-gray/80 mt-3">New clients only • Up to $30 value • Valid for 3 months</p>
            </div>
          ) : (
            <div className="text-center mb-5">
              {isWelcomeOffer && (
                <>
                  <div className="inline-block bg-dark-sage/20 text-dark-sage px-6 py-2 rounded-full text-sm font-bold mb-3">
                    🎁 SPECIAL OFFER
                  </div>
                  <p className="text-2xl font-bold text-dark-sage mb-1">15% OFF</p>
                  {description && <p className="text-sm text-warm-gray leading-relaxed">{description}</p>}
                  <p className="text-xs text-warm-gray/80 mt-2">New clients only • Up to $30 value</p>
                </>
              )}
              {!isWelcomeOffer && title && <h3 className="text-2xl font-serif text-charcoal mb-2">{title}</h3>}
              {!isWelcomeOffer && description && (
                <p className="text-sm text-warm-gray leading-relaxed">{description}</p>
              )}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="firstName" className="sr-only">First Name</label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border ${errors.firstName ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage transition-all`}
              placeholder="First name *"
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? "firstname-error" : undefined}
            />
            {errors.firstName && (
              <p id="firstname-error" className="text-red-600 text-xs mt-0.5">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="sr-only">Last Name</label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border ${errors.lastName ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage transition-all`}
              placeholder="Last name *"
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? "lastname-error" : undefined}
            />
            {errors.lastName && (
              <p id="lastname-error" className="text-red-600 text-xs mt-0.5">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="sr-only">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-3 py-2.5 text-sm border ${errors.email ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage transition-all`}
            placeholder="your@email.com *"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="text-red-600 text-xs mt-0.5">{errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="sr-only">Phone</label>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`w-full px-3 py-2.5 text-sm border ${errors.phone ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage transition-all`}
            placeholder="(555) 123-4567 *"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone && (
            <p id="phone-error" className="text-red-600 text-xs mt-0.5">{errors.phone}</p>
          )}
        </div>

        {includeAddressAndBirthday && (
          <>
            <div>
              <label htmlFor="address" className="sr-only">Address</label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full px-3 py-2.5 text-sm border ${errors.address ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage transition-all`}
                placeholder="Address (optional)"
                aria-invalid={!!errors.address}
                aria-describedby={errors.address ? "address-error" : undefined}
              />
              {errors.address && (
                <p id="address-error" className="text-red-600 text-xs mt-0.5">{errors.address}</p>
              )}
            </div>

            <div>
              <label htmlFor="birthday" className="sr-only">Birthday</label>
              <input
                type="date"
                id="birthday"
                value={birthday}
                onChange={(e) => {
                  setBirthday(e.target.value);
                  if (errors.birthday) {
                    setErrors({ ...errors, birthday: undefined });
                  }
                }}
                className={`w-full px-3 py-2.5 text-sm border ${errors.birthday ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage transition-all`}
                placeholder="Birthday *"
                aria-invalid={!!errors.birthday}
                aria-required="true"
                aria-describedby={errors.birthday ? "birthday-error" : "birthday-required"}
              />
              {errors.birthday && (
                <p id="birthday-error" className="text-red-600 text-xs mt-0.5">{errors.birthday}</p>
              )}
              {!errors.birthday && (
                <p id="birthday-required" className="text-xs text-warm-gray/70 mt-1">Birthday <span className="text-dark-sage">*</span></p>
              )}
            </div>
          </>
        )}
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="w-3.5 h-3.5 text-dark-sage border-charcoal/20 rounded focus:ring-dark-sage"
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? "consent-error" : undefined}
          />
          <label htmlFor="consent" className="ml-2 text-xs text-warm-gray">
            I agree to receive updates <span className="text-dark-sage">*</span>
          </label>
        </div>
        {errors.consent && (
          <p id="consent-error" className="text-red-600 text-xs">{errors.consent}</p>
        )}
        
        <motion.button
          type="submit"
          className="w-full bg-dark-sage text-charcoal py-2.5 rounded-lg text-sm font-semibold hover:bg-sage-dark hover:shadow-lg transition-all duration-200 shadow-sm"
          animate={isWelcomeOffer ? {
            scale: [1, 1.05, 1],
          } : {}}
          transition={isWelcomeOffer ? {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          } : {}}
        >
          {isWelcomeOffer ? 'Claim 15% Off' : 'Join the List'}
        </motion.button>
      </form>
      
      {/* Maybe Later Button - Shows below the form for welcome offers */}
      {isWelcomeOffer && onCloseOffer && !showThankYouMessage && (
        <>
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowConfirmDialog(true)}
              className="text-sm text-warm-gray hover:text-charcoal transition-colors underline hover:no-underline font-medium"
              type="button"
            >
              Maybe later
            </button>
          </div>
          
          <ConfirmationDialog
            isOpen={showConfirmDialog}
            message="Are you sure you want to throw away your 15% off? This offer won't be shown again."
            onConfirm={() => {
              setShowConfirmDialog(false);
              onCloseOffer(true);
            }}
            onCancel={() => setShowConfirmDialog(false)}
            confirmText="Yes, throw it away"
            cancelText="Keep my offer"
          />
        </>
      )}
      
      {/* Terms & Conditions - Compact Link */}
      {isWelcomeOffer && (
        <div className="mt-2 text-center">
          <a 
            href="/terms" 
            target="_blank"
            className="text-xs text-warm-gray hover:text-charcoal underline"
          >
            Terms & Conditions
          </a>
        </div>
      )}
      
      {/* Maybe later button for non-welcome offers */}
      {showCloseLink && onCloseLinkClick && !isWelcomeOffer && (
        <div className="mt-4 text-center">
          <button
            onClick={onCloseLinkClick}
            className="text-sm text-warm-gray hover:text-charcoal transition-colors underline hover:no-underline font-medium"
            type="button"
          >
            Maybe later
          </button>
        </div>
      )}
        </>
      ) : (
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center"
              role="alert"
            >
              {showThankYouMessage ? (
                <>
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="inline-block bg-gradient-to-r from-dark-sage/20 to-sage-light/20 text-dark-sage px-8 py-3 rounded-full text-base font-bold mb-6"
                  >
                    🎉 SUCCESS
                  </motion.div>
                  <h1 className="text-4xl md:text-5xl font-serif text-charcoal mb-4">
                    Thank You!
                  </h1>
                  <p className="text-warm-gray text-lg leading-relaxed mb-6">
                    You&apos;ve successfully signed up!
                  </p>
                  <div className="bg-dark-sage/20 rounded-lg p-6 mb-6">
                    <p className="text-base text-charcoal mb-3 font-semibold">
                      We&apos;ll keep you posted with updates
                    </p>
                    <p className="text-sm text-warm-gray leading-relaxed">
                      Your exclusive 15% off discount will be sent to your email shortly.
                    </p>
                  </div>
                  <p className="text-xs text-warm-gray/70 leading-relaxed">
                    By joining, you agree to receive updates from Aura Wellness Aesthetics. 
                    We respect your privacy and never share your information.
                  </p>
                </>
              ) : (
                <div className="mt-4 p-6 bg-dark-sage/20 text-charcoal rounded-lg text-center">
                  <p className="text-sm font-semibold text-dark-sage mb-1">🎉 You&apos;re all set!</p>
                  <p className="text-xs text-warm-gray">Check your email for your 15% off code.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

