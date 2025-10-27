'use client';

import { useEffect, useState } from 'react';
import EmailCaptureModal from './EmailCaptureModal';

export default function SimpleAutoModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has already submitted the welcome offer
    const submitted = localStorage.getItem('welcomeOfferSubmitted');
    if (submitted === 'true') {
      return;
    }

    const timer = setTimeout(() => {
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

