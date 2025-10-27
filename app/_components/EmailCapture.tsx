'use client';

import { FormEvent, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailCaptureProps {
  title?: string;
  description?: string;
  includeSMS?: boolean;
  showCloseLink?: boolean;
  onCloseLinkClick?: () => void;
}

export default function EmailCapture({ 
  title = "Join the Waitlist",
  description = "Be the first to book when we launch. Exclusive perks for early signups.",
  includeSMS = true,
  showCloseLink = false,
  onCloseLinkClick
}: EmailCaptureProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; email?: string; phone?: string; consent?: string }>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const newErrors: { firstName?: string; lastName?: string; email?: string; phone?: string; consent?: string } = {};
    
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
    
    if (!consent) {
      newErrors.consent = 'Please agree to receive updates';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      // Submit to Brevo API
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          firstName,
          lastName,
          email, 
          phone,
          birthday: '',
          address: '',
        }),
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
      setConsent(false);
      
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      console.error('Subscription error:', error);
      setErrors({ email: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-serif text-charcoal mb-2">{title}</h3>
        <p className="text-sm text-warm-gray leading-relaxed">{description}</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="firstName" className="sr-only">First Name</label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border ${errors.firstName ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-sage transition-all`}
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
              className={`w-full px-3 py-2.5 text-sm border ${errors.lastName ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-sage transition-all`}
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
            className={`w-full px-3 py-2.5 text-sm border ${errors.email ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-sage transition-all`}
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
            className={`w-full px-3 py-2.5 text-sm border ${errors.phone ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-sage transition-all`}
            placeholder="(555) 123-4567 *"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone && (
            <p id="phone-error" className="text-red-600 text-xs mt-0.5">{errors.phone}</p>
          )}
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="w-3.5 h-3.5 text-sage border-charcoal/20 rounded focus:ring-sage"
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? "consent-error" : undefined}
          />
          <label htmlFor="consent" className="ml-2 text-xs text-warm-gray">
            I agree to receive updates <span className="text-sage">*</span>
          </label>
        </div>
        {errors.consent && (
          <p id="consent-error" className="text-red-600 text-xs">{errors.consent}</p>
        )}
        
        <button
          type="submit"
          className="w-full bg-charcoal text-ivory py-2.5 rounded-lg text-sm font-semibold hover:bg-sage hover:text-charcoal transition-all duration-200 shadow-sm hover:shadow-md"
        >
          Secure My Spot
        </button>
      </form>
      
      {/* Close Link - Shows below the form */}
      {showCloseLink && onCloseLinkClick && (
        <div className="mt-4 text-center">
          <button
            onClick={onCloseLinkClick}
            className="text-sm text-warm-gray hover:text-charcoal transition-colors underline"
            type="button"
          >
            Close
          </button>
        </div>
      )}
      
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 p-4 bg-sage/20 text-charcoal rounded text-center"
            role="alert"
          >
            You&apos;re in. We&apos;ll email you when booking opens.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

