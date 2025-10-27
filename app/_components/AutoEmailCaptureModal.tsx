'use client';

import { useEffect, useState } from 'react';
import EmailCaptureModal from './EmailCaptureModal';

export default function AutoEmailCaptureModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCloseButton, setShowCloseButton] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the modal
    const dismissed = localStorage.getItem('emailCaptureDismissed');
    if (dismissed) {
      return;
    }

    // Open modal after 5 seconds
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
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // Remember that user dismissed (optional - comment out if you want it to show again)
    localStorage.setItem('emailCaptureDismissed', 'true');
  };

  return (
    <EmailCaptureModal 
      isOpen={isOpen} 
      onClose={handleClose}
      showCloseButton={showCloseButton}
    />
  );
}

