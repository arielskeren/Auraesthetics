'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ServiceTipsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ServiceTipsModal({ isOpen, onClose }: ServiceTipsModalProps) {
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 max-h-screen overflow-hidden">
            <motion.div
              className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] shadow-2xl relative overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 text-warm-gray hover:text-charcoal transition-colors rounded-full hover:bg-sand"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>

              {/* Scrollable Content */}
              <div className="overflow-y-auto max-h-[90vh] p-6">
                <h2 className="text-2xl md:text-h2 font-serif text-charcoal mb-6 pr-8">
                  Best Tips Before and After Your Service
                </h2>

                <div className="space-y-6">
                  {/* Before Your Service */}
                  <div>
                    <h3 className="text-xl font-serif text-charcoal mb-4">Before Your Service</h3>
                    <ul className="space-y-2 text-sm text-warm-gray">
                      <li className="flex items-start">
                        <span className="mr-2 text-dark-sage">•</span>
                        <span>Avoid retinoids, exfoliants, or acids 48–72 hours prior</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2 text-dark-sage">•</span>
                        <span>Minimize sun exposure and tanning</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2 text-dark-sage">•</span>
                        <span>Arrive with clean, makeup‑free skin when possible</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2 text-dark-sage">•</span>
                        <span>Communicate any new medications or skin concerns</span>
                      </li>
                    </ul>
                  </div>

                  {/* After Your Service */}
                  <div>
                    <h3 className="text-xl font-serif text-charcoal mb-4">After Your Service</h3>
                    <ul className="space-y-2 text-sm text-warm-gray">
                      <li className="flex items-start">
                        <span className="mr-2 text-dark-sage">•</span>
                        <span>Wear SPF daily (non‑negotiable!)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2 text-dark-sage">•</span>
                        <span>Skip heat, intense workouts, and actives for 24–48 hours</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2 text-dark-sage">•</span>
                        <span>Keep skin hydrated and avoid picking</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2 text-dark-sage">•</span>
                        <span>Follow any customized aftercare instructions provided</span>
                      </li>
                    </ul>
                  </div>

                  {/* Contraindications */}
                  <div className="rounded-xl bg-dark-sage/10 p-5 border border-dark-sage/20">
                    <h3 className="text-lg font-serif text-charcoal mb-3">Contraindications</h3>
                    <p className="text-sm text-warm-gray leading-relaxed">
                      Some services are not appropriate during pregnancy, while using isotretinoin (Accutane), or with
                      active infections, open lesions, or medical devices (pacemakers, etc.). Share your full health history
                      during intake so Amy can recommend the safest, most effective options for you.
                    </p>
                  </div>
                </div>

                {/* Close Button at Bottom */}
                <div className="mt-8 pt-6 border-t border-sand">
                  <button
                    onClick={onClose}
                    className="w-full py-3 px-6 bg-dark-sage text-charcoal rounded-lg font-semibold hover:bg-sage-dark transition-colors"
                  >
                    Got it, thanks!
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

