'use client';

import SimpleAutoModal from './_components/SimpleAutoModal';
import FloatingWelcomeOffer from './_components/FloatingWelcomeOffer';

export default function ClientLayout() {
  console.log('🔥 ClientLayout rendering!');
  return (
    <>
      <SimpleAutoModal />
      <FloatingWelcomeOffer />
    </>
  );
}

