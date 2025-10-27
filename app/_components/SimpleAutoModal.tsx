'use client';

import { useEffect, useState } from 'react';
import EmailCaptureModal from './EmailCaptureModal';

export default function SimpleAutoModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    console.log('⏰ Timer starting...');
    
    const timer = setTimeout(() => {
      console.log('✅ Timer fired - opening modal!');
      setIsOpen(true);
    }, 5000);

    return () => {
      console.log('🧹 Timer cleaned up');
      clearTimeout(timer);
    };
  }, []);

  const handleClose = () => {
    console.log('❌ Modal closed (minimized)');
    setIsOpen(false);
    localStorage.setItem('welcomeOfferMinimized', 'true');
  };

  const handleCloseOffer = (confirmed: boolean) => {
    console.log('handleCloseOffer called with confirmed:', confirmed);
    if (confirmed) {
      setIsOpen(false);
      localStorage.setItem('welcomeOfferMinimized', 'true');
    }
  };

  const handleClaimed = () => {
    console.log('✅ Welcome offer claimed');
    setIsOpen(false);
    localStorage.setItem('welcomeOfferSubmitted', 'true');
    localStorage.removeItem('welcomeOfferMinimized');
  };

  console.log('🔄 Rendering SimpleAutoModal, isOpen:', isOpen);

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

