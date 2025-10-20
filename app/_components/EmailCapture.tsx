'use client';

import { FormEvent, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailCaptureProps {
  title?: string;
  description?: string;
  includeSMS?: boolean;
}

export default function EmailCapture({ 
  title = "Booking opens soon.",
  description = "Be the first to know when online booking goes live and receive launch‑week perks.",
  includeSMS = true 
}: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [sms, setSms] = useState('');
  const [consent, setConsent] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; consent?: string }>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const newErrors: { email?: string; consent?: string } = {};
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!consent) {
      newErrors.consent = 'Please agree to receive updates';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Clear errors and show success
    setErrors({});
    setShowSuccess(true);
    
    // Reset form
    setEmail('');
    setSms('');
    setConsent(false);
    
    // Hide success message after 5 seconds
    setTimeout(() => setShowSuccess(false), 5000);
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-sm max-w-2xl mx-auto">
      <h3 className="text-h2 text-charcoal mb-2 text-center font-serif">{title}</h3>
      <p className="text-warm-gray text-center mb-6 leading-relaxed">{description}</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-charcoal mb-2">
            Email <span className="text-sage">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-4 py-3 border ${errors.email ? 'border-red-400' : 'border-sand'} rounded focus:outline-none focus:ring-2 focus:ring-sage`}
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="text-red-600 text-sm mt-1">{errors.email}</p>
          )}
        </div>
        
        {includeSMS && (
          <div>
            <label htmlFor="sms" className="block text-sm font-medium text-charcoal mb-2">
              Phone (optional, for SMS updates)
            </label>
            <input
              type="tel"
              id="sms"
              value={sms}
              onChange={(e) => setSms(e.target.value)}
              className="w-full px-4 py-3 border border-sand rounded focus:outline-none focus:ring-2 focus:ring-sage"
              placeholder="(555) 123-4567"
            />
          </div>
        )}
        
        <div className="flex items-start">
          <input
            type="checkbox"
            id="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 w-4 h-4 text-sage border-sand rounded focus:ring-sage"
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? "consent-error" : undefined}
          />
          <label htmlFor="consent" className="ml-3 text-sm text-warm-gray">
            I agree to receive email updates about booking availability and launch perks. 
            <span className="text-sage"> *</span>
          </label>
        </div>
        {errors.consent && (
          <p id="consent-error" className="text-red-600 text-sm">{errors.consent}</p>
        )}
        
        <button
          type="submit"
          className="w-full bg-charcoal text-ivory py-3 rounded font-medium hover:bg-sage hover:text-charcoal transition-colors duration-200"
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

