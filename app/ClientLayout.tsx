'use client';

import { usePathname } from 'next/navigation';
import SimpleAutoModal from './_components/SimpleAutoModal';
import FloatingWelcomeOffer from './_components/FloatingWelcomeOffer';

export default function ClientLayout() {
  const pathname = usePathname();
  const isLandingPage = pathname === '/landing';

  return (
    <>
      {!isLandingPage && <SimpleAutoModal />}
      {!isLandingPage && <FloatingWelcomeOffer />}
    </>
  );
}

