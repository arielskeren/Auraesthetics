'use client';

import { usePathname } from 'next/navigation';
import Nav from './Nav';
import Footer from './Footer';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/landing';

  if (isLandingPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Nav />
      <main id="main-content">
        {children}
      </main>
      <Footer />
    </>
  );
}

