'use client';

import { useEffect, useState } from 'react';
import EmailCaptureModal from './EmailCaptureModal';

export default function SimpleAutoModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has already submitted the welcome offer
    const submitted = localStorage.getItem('welcomeOfferSubmitted');
    if (submitted === 'true') {
      console.log('📧 SimpleAutoModal: Welcome offer already submitted, not showing modal');
      return;
    }

    console.log('📧 SimpleAutoModal: Starting 5 second timer for modal');
    const timer = setTimeout(() => {
      console.log('📧 SimpleAutoModal: Opening modal after 5 seconds');
      setIsOpen(true);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('welcomeOfferMinimized', 'true');
  };

  const handleCloseOffer = (confirmed: boolean) => {
    if (confirmed) {
      setIsOpen(false);
      localStorage.setItem('welcomeOfferMinimized', 'true');
    }
  };

  const handleClaimed = () => {
    setIsOpen(false);
    localStorage.setItem('welcomeOfferSubmitted', 'true');
    localStorage.removeItem('welcomeOfferMinimized');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <EmailCaptureModal 
      isOpen={isOpen} 
      onClose={handleClose}
      showCloseButton={true}
      isWelcomeOffer={true}
      onCloseOffer={handleCloseOffer}
      onClaimed={handleClaimed}
    />
  );
}

