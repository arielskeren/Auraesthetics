'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Button from './Button';
import Link from 'next/link';

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
  if (!service) return null;

  // Generate before/after placeholder images based on service category
  const placeholderImages = {
    'Facials': ['🥑', '✨'],
    'Advanced': ['🔬', '🌟'],
    'Brows & Lashes': ['🎨', '💫'],
    'Waxing': ['🌈', '✨'],
  };

  const placeholders = placeholderImages[service.category as keyof typeof placeholderImages] || ['🖼️', '✨'];

  const handleBookingClick = () => {
    if (service.calBookingUrl) {
      // Open Cal.com in a new window/tab
      window.open(service.calBookingUrl, '_blank', 'noopener,noreferrer');
      onClose();
    } else {
      alert('Booking for this service is being set up. Please check back soon!');
    }
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
                  onClick={onClose}
                  className="p-1.5 bg-white rounded-full hover:bg-sand/30 transition-colors"
                  aria-label="Close modal"
                >
                  <X size={18} className="text-charcoal" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-hidden">
                {/* Hero Image Placeholder */}
                <div className="h-32 bg-gradient-to-br from-dark-sage/60 via-taupe/40 to-sand relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl opacity-30">{placeholders[0]}</span>
                  </div>
                </div>

                {/* Service Details */}
                <div className="p-4">
                  {/* Header with Duration/Price on Right */}
                  <div className="mb-3">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex-1">
                        <span className="inline-block px-2 py-0.5 bg-dark-sage/20 text-dark-sage text-[10px] font-medium rounded-full mb-1">
                          {service.category}
                        </span>
                        <h2 className="text-xl md:text-2xl font-serif text-charcoal mb-1">{service.name}</h2>
                        <p className="text-sm text-warm-gray leading-tight">{service.summary}</p>
                      </div>
                      {/* Duration & Price */}
                      <div className="flex flex-col gap-1.5 text-xs text-warm-gray">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">{service.duration}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">{service.price}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop: Side-by-side Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                    {/* Left: Booking CTA */}
                    <div className="order-2 lg:order-1">
                      <div className="p-4 bg-dark-sage/10 rounded-lg border-2 border-dark-sage/30">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-dark-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h4 className="text-sm font-semibold text-charcoal">Book This Treatment</h4>
                        </div>
                        <p className="text-xs text-warm-gray mb-4">
                          Click the button below to view available times and complete your booking in our secure booking system.
                        </p>
                        <Button 
                          variant="primary" 
                          className="w-full"
                          onClick={handleBookingClick}
                        >
                          Book Now on Cal.com
                        </Button>
                        <p className="text-[9px] text-warm-gray/70 text-center italic mt-3">
                          Opens in a new tab
                        </p>
                      </div>
                    </div>

                    {/* Right: Before/After & Description */}
                    <div className="order-1 lg:order-2">
                      {/* Description */}
                      {service.description && (
                        <div className="mb-2">
                          <h3 className="text-sm font-serif text-charcoal mb-1">About This Treatment</h3>
                          <p className="text-xs text-warm-gray leading-tight">{service.description}</p>
                        </div>
                      )}

                      {/* Before & After Grid */}
                      <div>
                        <h3 className="text-sm font-serif text-charcoal mb-1.5">Before & After</h3>
                        <div className="grid grid-cols-2 gap-1.5">
                      <motion.div
                        className="aspect-[4/3] bg-gradient-to-br from-warm-gray/20 via-taupe/30 to-sand rounded overflow-hidden relative group cursor-pointer"
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl mb-0.5 opacity-40">{placeholders[0]}</span>
                          <p className="text-[10px] text-warm-gray font-medium">Before</p>
                        </div>
                        <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/5 transition-colors" />
                      </motion.div>
                      <motion.div
                        className="aspect-[4/3] bg-gradient-to-br from-dark-sage/30 via-taupe/20 to-sand rounded overflow-hidden relative group cursor-pointer"
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl mb-0.5 opacity-40">{placeholders[1]}</span>
                          <p className="text-[10px] text-warm-gray font-medium">After</p>
                        </div>
                        <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/5 transition-colors" />
                      </motion.div>
                        </div>
                        <p className="text-[9px] text-warm-gray/70 mt-1 text-center italic">
                          Results may vary
                        </p>
                      </div>
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

