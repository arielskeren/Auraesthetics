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
                <div className="h-32 bg-gradient-to-br from-sage/60 via-taupe/40 to-sand relative">
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
                        <span className="inline-block px-2 py-0.5 bg-sage/20 text-sage text-[10px] font-medium rounded-full mb-1">
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
                    {/* Left: Calendar */}
                    <div className="order-2 lg:order-1">
                      <div className="p-2.5 bg-sand/30 rounded-lg border border-taupe/20">
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="text-[10px] font-semibold text-charcoal">Select a Date</h4>
                          <svg className="w-3.5 h-3.5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="grid grid-cols-7 gap-0.5 mb-1.5">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <div key={i} className="text-center text-[9px] font-medium text-warm-gray py-0.5">
                              {day}
                            </div>
                          ))}
                          {Array.from({ length: 28 }, (_, i) => i + 1).slice(0, 14).map((day) => (
                            <div
                              key={day}
                              className="aspect-square flex items-center justify-center text-[10px] text-warm-gray hover:bg-sage/20 rounded cursor-pointer transition-colors"
                            >
                              {day}
                            </div>
                          ))}
                        </div>
                        <p className="text-[9px] text-warm-gray/70 text-center italic mb-2">
                          Calendar integration coming soon
                        </p>
                        {/* Book Now Button Below Calendar */}
                        <Link href="/book" onClick={onClose} className="block">
                          <Button variant="primary" className="w-full text-xs py-1.5">
                            Book Now
                          </Button>
                        </Link>
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
                        className="aspect-[4/3] bg-gradient-to-br from-sage/30 via-taupe/20 to-sand rounded overflow-hidden relative group cursor-pointer"
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

