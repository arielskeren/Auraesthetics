'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import EmailCapture from './EmailCapture';
import ConfirmationDialog from './ConfirmationDialog';

interface EmailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  showCloseButton?: boolean;
  isWelcomeOffer?: boolean;
  onCloseOffer?: (confirmed: boolean) => void;
  onClaimed?: () => void;
}

export default function EmailCaptureModal({ 
  isOpen, 
  onClose, 
  showCloseButton = true, 
  isWelcomeOffer = true,
  onCloseOffer,
  onClaimed
}: EmailCaptureModalProps) {
  console.log('EmailCaptureModal - isOpen:', isOpen, 'showCloseButton:', showCloseButton);
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  return (
    <>
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
              className="bg-white rounded-xl max-w-md w-full max-h-[90vh] shadow-2xl relative overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button - Trigger confirmation if welcome offer */}
              {showCloseButton && (
                <button
                  onClick={() => {
                    // If it's a welcome offer and we have the handler, trigger confirmation dialog
                    if (isWelcomeOffer && onCloseOffer) {
                      setShowConfirmDialog(true);
                    } else {
                      // Regular close for non-welcome offers
                      onClose();
                    }
                  }}
                  className="absolute top-3 right-3 z-10 p-1 text-warm-gray/40 hover:text-warm-gray transition-colors"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              )}

              {/* Scrollable Content */}
              <div className="overflow-y-auto max-h-[90vh]">
                <div className="p-5">
                  <EmailCapture 
                    title={isWelcomeOffer ? "Welcome Offer" : "Join Our Waitlist"}
                    description={isWelcomeOffer ? "Join our waitlist and get 15% off your first service" : "Be the first to know when booking opens"}
                    includeSMS={true}
                    showCloseLink={showCloseButton}
                    onCloseLinkClick={onClose}
                    isWelcomeOffer={isWelcomeOffer}
                    onCloseOffer={onCloseOffer}
                    onSuccess={onClaimed}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
    
    {/* Confirmation Dialog for Welcome Offer */}
    <ConfirmationDialog
      isOpen={showConfirmDialog}
      message="Are you sure you want to throw away your 15% off? This offer won't be shown again."
      onConfirm={() => {
        setShowConfirmDialog(false);
        if (onCloseOffer) {
          onCloseOffer(true);
        }
      }}
      onCancel={() => setShowConfirmDialog(false)}
      confirmText="Yes, throw it away"
      cancelText="Keep my offer"
    />
    </>
  );
}

