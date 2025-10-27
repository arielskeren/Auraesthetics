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
    console.log('❌ Modal closed');
    setIsOpen(false);
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
    />
  );
}

