'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import EmailCapture from './EmailCapture';

export default function FloatingWelcomeOffer() {
  const [isOpen, setIsOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    // Check if user has already submitted the welcome offer
    const submitted = localStorage.getItem('welcomeOfferSubmitted');
    
    // Only show bubble if they haven't submitted and haven't permanently dismissed it
    if (!submitted && !localStorage.getItem('floatingOfferPermanentlyClosed')) {
      setShowBubble(true);
    }
  }, []);

  const handleBubbleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handlePermanentlyClose = () => {
    setIsOpen(false);
    setShowBubble(false);
    localStorage.setItem('floatingOfferPermanentlyClosed', 'true');
  };

  const handleSuccess = () => {
    // User submitted the form, hide the bubble
    setShowBubble(false);
    setIsOpen(false);
    localStorage.setItem('welcomeOfferSubmitted', 'true');
    // Also mark in a separate key for tracking
    localStorage.setItem('userSubmittedWelcomeOffer', 'true');
  };

  if (!showBubble) {
    return null;
  }

  return (
    <>
      {/* Floating Bubble */}
      <motion.div
        className="fixed bottom-6 right-6 z-40"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <button
          onClick={handleBubbleClick}
          className="relative bg-sage text-charcoal rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Get your 15% welcome discount"
        >
          <svg 
            className="w-8 h-8" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          
          {/* Pulsing Red Notification Dot */}
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full"
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [1, 0.7, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </button>
      </motion.div>

      {/* Inline Form Overlay - Opens when bubble is clicked */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-charcoal/80 backdrop-blur-sm z-40 flex items-end justify-end p-6 md:p-8"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 50 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl relative max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={handlePermanentlyClose}
                className="absolute top-4 right-4 z-10 p-2 hover:bg-sand/30 rounded-full transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-charcoal" />
              </button>

              {/* Scrollable Content */}
              <div className="overflow-y-auto max-h-[80vh]">
                <div className="p-6">
                  <EmailCapture 
                    title="Welcome Offer"
                    description="Join our waitlist and get 15% off your first service"
                    includeSMS={true}
                    showCloseLink={false}
                    onCloseLinkClick={() => {}}
                    isWelcomeOffer={true}
                    onSuccess={handleSuccess}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

