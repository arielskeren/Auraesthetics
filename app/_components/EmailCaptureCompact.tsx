'use client';

import { FormEvent, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailCaptureCompactProps {
  title?: string;
  description?: string;
}

export default function EmailCaptureCompact({ 
  title = "Stay in the loop",
  description = "Get notified when booking opens"
}: EmailCaptureCompactProps) {
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
      newErrors.firstName = 'Required';
    }
    
    if (!lastName || lastName.trim() === '') {
      newErrors.lastName = 'Required';
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Valid email required';
    }
    
    if (!phone || phone.trim() === '') {
      newErrors.phone = 'Required';
    }
    
    if (!consent) {
      newErrors.consent = 'Agreement required';
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
          signupSource: 'footer',
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
    <div className="max-w-4xl mx-auto">
      <h4 className="text-sm font-serif text-charcoal mb-1">{title}</h4>
      <p className="text-xs text-warm-gray mb-4">{description}</p>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="footer-firstName" className="block text-xs font-medium text-charcoal mb-1">
              First <span className="text-sage">*</span>
            </label>
            <input
              type="text"
              id="footer-firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={`w-full px-3 py-2 text-sm border ${errors.firstName ? 'border-red-400' : 'border-sand'} rounded focus:outline-none focus:ring-1 focus:ring-sage`}
              placeholder="Jane"
              aria-invalid={!!errors.firstName}
            />
          </div>

          <div>
            <label htmlFor="footer-lastName" className="block text-xs font-medium text-charcoal mb-1">
              Last <span className="text-sage">*</span>
            </label>
            <input
              type="text"
              id="footer-lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={`w-full px-3 py-2 text-sm border ${errors.lastName ? 'border-red-400' : 'border-sand'} rounded focus:outline-none focus:ring-1 focus:ring-sage`}
              placeholder="Smith"
              aria-invalid={!!errors.lastName}
            />
          </div>
        </div>

        <div>
          <label htmlFor="footer-email" className="block text-xs font-medium text-charcoal mb-1">
            Email <span className="text-sage">*</span>
          </label>
          <input
            type="email"
            id="footer-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-3 py-2 text-sm border ${errors.email ? 'border-red-400' : 'border-sand'} rounded focus:outline-none focus:ring-1 focus:ring-sage`}
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
          />
        </div>

        <div>
          <label htmlFor="footer-phone" className="block text-xs font-medium text-charcoal mb-1">
            Phone <span className="text-sage">*</span>
          </label>
          <input
            type="tel"
            id="footer-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`w-full px-3 py-2 text-sm border ${errors.phone ? 'border-red-400' : 'border-sand'} rounded focus:outline-none focus:ring-1 focus:ring-sage`}
            placeholder="(555) 123-4567"
            aria-invalid={!!errors.phone}
          />
        </div>
        
        <div className="flex items-start">
          <input
            type="checkbox"
            id="footer-consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 w-4 h-4 text-sage border-sand rounded focus:ring-sage"
            aria-invalid={!!errors.consent}
          />
          <label htmlFor="footer-consent" className="ml-2 text-xs text-warm-gray">
            I agree to receive updates <span className="text-sage">*</span>
          </label>
        </div>
        {errors.consent && (
          <p className="text-red-600 text-xs">{errors.consent}</p>
        )}
        
        <button
          type="submit"
          className="w-full bg-charcoal text-ivory py-2 rounded text-sm font-medium hover:bg-sage hover:text-charcoal transition-colors duration-200"
        >
          Join the List
        </button>
      </form>
      
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 p-3 bg-sage/20 text-charcoal rounded text-xs text-center"
            role="alert"
          >
            ✓ You&apos;re on the list! We&apos;ll email you when booking opens.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

