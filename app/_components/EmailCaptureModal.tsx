'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import EmailCapture from './EmailCapture';

interface EmailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  showCloseButton?: boolean;
}

export default function EmailCaptureModal({ isOpen, onClose, showCloseButton = true }: EmailCaptureModalProps) {
  console.log('EmailCaptureModal - isOpen:', isOpen, 'showCloseButton:', showCloseButton);
  
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
              className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl relative"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button - Subtle, only visible after delay */}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 z-10 p-1 text-warm-gray/40 hover:text-warm-gray transition-colors"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              )}

              {/* Content */}
              <div className="p-6 md:p-8">
                <EmailCapture 
                  title="Join Our Waitlist"
                  description="Be the first to know when booking opens and receive exclusive launch-week perks."
                  includeSMS={true}
                  showCloseLink={showCloseButton}
                  onCloseLinkClick={onClose}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

