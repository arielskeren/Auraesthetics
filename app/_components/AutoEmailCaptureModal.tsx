'use client';

import { useEffect, useState } from 'react';
import EmailCaptureModal from './EmailCaptureModal';

export default function AutoEmailCaptureModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCloseButton, setShowCloseButton] = useState(false);

  useEffect(() => {
    // Open modal after 5 seconds
    const timer = setTimeout(() => {
      setIsOpen(true);
      console.log('Modal opened after 5 seconds');
    }, 5000);

    // Show close button after 8 seconds (3 seconds after modal opens)
    const closeButtonTimer = setTimeout(() => {
      setShowCloseButton(true);
      console.log('Close button enabled');
    }, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(closeButtonTimer);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // Modal will reappear next time user visits (no localStorage blocking)
  };

  return (
    <EmailCaptureModal 
      isOpen={isOpen} 
      onClose={handleClose}
      showCloseButton={showCloseButton}
    />
  );
}

