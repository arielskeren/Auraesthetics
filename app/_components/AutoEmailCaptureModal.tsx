'use client';

import { useEffect, useState } from 'react';
import EmailCaptureModal from './EmailCaptureModal';

export default function AutoEmailCaptureModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCloseButton, setShowCloseButton] = useState(false);

  useEffect(() => {
    // Check if modal was minimized - if so, show it again
    const minimized = localStorage.getItem('welcomeOfferMinimized');
    if (minimized && !localStorage.getItem('welcomeOfferSubmitted')) {
      setIsOpen(true);
    }
    
    // Open modal after 5 seconds if not already shown
    if (!minimized) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 5000);

      // Show close button after 8 seconds (3 seconds after modal opens)
      const closeButtonTimer = setTimeout(() => {
        setShowCloseButton(true);
      }, 8000);

      return () => {
        clearTimeout(timer);
        clearTimeout(closeButtonTimer);
      };
    }
  }, []);

  const handleMinimize = () => {
    setIsOpen(false);
    setIsMinimized(true);
    localStorage.setItem('welcomeOfferMinimized', 'true');
  };

  const handleCloseOffer = (confirmed: boolean) => {
    if (confirmed) {
      // User confirmed they want to throw away the offer
      setIsOpen(false);
      localStorage.setItem('welcomeOfferMinimized', 'true');
    }
    // If they clicked "Keep my offer", modal stays open
  };

  const handleClaimed = () => {
    // User claimed the offer, close and mark as submitted
    setIsOpen(false);
    setIsMinimized(false);
    localStorage.setItem('welcomeOfferSubmitted', 'true');
    localStorage.removeItem('welcomeOfferMinimized');
  };

  return (
    <EmailCaptureModal 
      isOpen={isOpen} 
      onClose={handleMinimize}
      showCloseButton={showCloseButton}
      isWelcomeOffer={true}
      onCloseOffer={handleCloseOffer}
      onClaimed={handleClaimed}
    />
  );
}

