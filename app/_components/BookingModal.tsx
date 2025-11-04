'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useCalEmbed, initCalService, extractCalLink } from '../_hooks/useCalEmbed';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: {
    name: string;
    summary: string;
    description?: string;
    duration: string;
    price: string;
    category: string;
    slug?: string;
    calBookingUrl?: string | null;
  } | null;
}

export default function BookingModal({ isOpen, onClose, service }: BookingModalProps) {
  useCalEmbed();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const calLink = service ? extractCalLink(service.calBookingUrl) : null;
  const namespace = service?.slug || 'booking';

  // Initialize Cal.com when modal opens and service is available
  useEffect(() => {
    if (isOpen && service && calLink) {
      // Small delay to ensure Cal script is loaded
      const timer = setTimeout(() => {
        initCalService(namespace, calLink);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, service, calLink, namespace]);

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
              className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-xl relative"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-10 p-2 hover:bg-sand/30 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X size={20} className="text-charcoal" />
              </button>

              {/* Content */}
              <div className="overflow-y-auto max-h-[85vh]">
                <div className="p-8">
                  {/* Header */}
                  <div className="mb-6">
                    <span className="inline-block px-3 py-1 bg-dark-sage/20 text-dark-sage text-xs font-medium rounded-full mb-3">
                      {service.category}
                    </span>
                    <h2 className="text-2xl font-serif text-charcoal mb-2">{service.name}</h2>
                    <p className="text-warm-gray text-sm">{service.summary}</p>
                  </div>

                  {/* Service Details */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-sand/30 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-warm-gray mb-1">
                        <svg className="w-4 h-4 text-dark-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Duration</span>
                      </div>
                      <p className="text-charcoal font-medium">{service.duration}</p>
                    </div>

                    <div className="bg-sand/30 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-warm-gray mb-1">
                        <svg className="w-4 h-4 text-dark-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Price</span>
                      </div>
                      <p className="text-charcoal font-medium">{service.price}</p>
                    </div>
                  </div>

                  {/* Description */}
                  {service.description && (
                    <div className="mb-6">
                      <h3 className="text-lg font-serif text-charcoal mb-2">About This Treatment</h3>
                      <p className="text-sm text-warm-gray leading-relaxed">{service.description}</p>
                    </div>
                  )}

                  {/* Cal.com Element-Click Embed Button */}
                  {calLink ? (
                    <div className="mb-6">
                      <div className="bg-gradient-to-br from-dark-sage/10 to-sand rounded-lg p-6 text-center border-2 border-dark-sage/30">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <svg className="w-6 h-6 text-dark-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h4 className="text-lg font-semibold text-charcoal">Book Your Appointment</h4>
                        </div>
                        <p className="text-sm text-warm-gray mb-4">
                          Click below to view available times and complete your booking in our secure booking system.
                        </p>
                        <button
                          ref={buttonRef}
                          data-cal-link={calLink}
                          data-cal-namespace={namespace}
                          data-cal-config='{"layout":"month_view"}'
                          className="w-full bg-dark-sage text-charcoal py-3 rounded-lg font-semibold hover:bg-sage-dark hover:shadow-lg transition-all duration-200"
                        >
                          View Calendar & Book Now
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <div className="bg-gradient-to-br from-dark-sage/10 to-sand rounded-lg p-6 text-center border-2 border-dark-sage/30">
                        <p className="text-sm text-warm-gray">
                          Booking for this service is being set up. Please check back soon!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Info */}
                  <div className="bg-dark-sage/5 border-l-4 border-dark-sage p-4 rounded">
                    <p className="text-xs text-warm-gray">
                      <strong className="text-dark-sage">Note:</strong> Booking opens in a popup calendar through Cal.com with Stripe payment integration.
                    </p>
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

