'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Button from './Button';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCalEmbed, initCalService, extractCalLink } from '../_hooks/useCalEmbed';
import { getServicePhotoPaths } from '../_utils/servicePhotos';
import CustomPaymentModal from './CustomPaymentModal';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: {
    name: string;
    summary: string;
    description?: string;
    duration: string;
    price: string;
    category: string;
    slug: string;
    calBookingUrl?: string | null;
  } | null;
}

export default function ServiceModal({ isOpen, onClose, service }: ServiceModalProps) {
  useCalEmbed();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const calLink = service ? extractCalLink(service.calBookingUrl) : null;
  const namespace = service?.slug || 'booking';
  
  // Hooks must be called before any early returns
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

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

  // Reset photo state when service changes
  useEffect(() => {
    setPhotoIndex(0);
    setShowPlaceholder(false);
  }, [service?.slug]);

  if (!service) return null;

  // Generate placeholder emoji for gradient fallback
  const placeholderImages = {
    'Facials': '🥑',
    'Advanced': '🔬',
    'Brows & Lashes': '🎨',
    'Waxing': '🌈',
  };

  const placeholderEmoji = placeholderImages[service.category as keyof typeof placeholderImages] || '🖼️';
  const photoPaths = getServicePhotoPaths(service.slug);

  const handlePhotoError = () => {
    if (photoIndex < photoPaths.length - 1) {
      // Try next fallback path
      setPhotoIndex(photoIndex + 1);
    } else {
      // No more fallbacks, show gradient placeholder
      setShowPlaceholder(true);
    }
  };

  const handleClose = () => {
    onClose();
  };

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
              className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl relative"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Top Bar with Close */}
              <div className="flex justify-end items-center p-3 border-b border-sand">
                <button
                  onClick={handleClose}
                  className="p-1.5 bg-white rounded-full hover:bg-sand/30 transition-colors"
                  aria-label="Close modal"
                >
                  <X size={18} className="text-charcoal" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-hidden">
                {/* Service Photo Banner - 18:9 aspect ratio */}
                {showPlaceholder || photoPaths.length === 0 ? (
                  <div className="relative w-full bg-gradient-to-br from-dark-sage/60 via-taupe/40 to-sand" style={{ aspectRatio: '18/9' }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl opacity-30">{placeholderEmoji}</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full max-w-5xl mx-auto" style={{ aspectRatio: '18/9', maxHeight: '50vh' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={photoPaths[photoIndex]} 
                      alt={service.name}
                      className="w-full h-full object-cover object-center"
                      onError={handlePhotoError}
                    />
                  </div>
                )}

                {/* Service Details */}
                <div className="p-6">
                  {/* Header with Duration/Price on Right */}
                  <div className="mb-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <span className="inline-block px-3 py-1 bg-dark-sage/20 text-dark-sage text-xs font-medium rounded-full mb-2">
                          {service.category}
                        </span>
                        <h2 className="text-2xl md:text-3xl font-serif text-charcoal mb-2">{service.name}</h2>
                        <p className="text-base text-warm-gray leading-relaxed">{service.summary}</p>
                      </div>
                      {/* Duration & Price */}
                      <div className="flex flex-col gap-2 text-sm text-warm-gray">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">{service.duration}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">{service.price}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Service Details */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Booking CTA */}
                    <div className="order-2 lg:order-1">
                      <div className="p-5 bg-dark-sage/10 rounded-lg border-2 border-dark-sage/30">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-6 h-6 text-dark-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h4 className="text-base font-semibold text-charcoal">Book This Treatment</h4>
                        </div>
                        <p className="text-sm text-warm-gray mb-4">
                          Click the button below to complete your payment and secure your booking time.
                        </p>
                        {calLink ? (
                          <Button
                            onClick={() => setShowPaymentModal(true)}
                            className="w-full"
                          >
                            Book Now
                          </Button>
                        ) : (
                          <Button 
                            variant="disabled" 
                            className="w-full"
                          >
                            Booking Coming Soon
                          </Button>
                        )}
                        <p className="text-xs text-warm-gray/70 text-center italic mt-3">
                          Secure payment required to book
                        </p>
                      </div>
                    </div>

                    {/* Right: Description */}
                    <div className="order-1 lg:order-2">
                      {service.description && (
                        <div>
                          <h3 className="text-lg font-serif text-charcoal mb-3">About This Treatment</h3>
                          <p className="text-sm text-warm-gray leading-relaxed">{service.description}</p>
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

      {/* Payment Modal */}
      <CustomPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        service={service}
      />
    </AnimatePresence>
  );
}

