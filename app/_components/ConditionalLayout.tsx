'use client';

import { usePathname } from 'next/navigation';
import Nav from './Nav';
import Footer from './Footer';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show footer on admin pages
  const isAdminPage = pathname?.startsWith('/admindash');
  
  return (
    <>
      {!isAdminPage && <Nav />}
      <main id="main-content">
        {children}
      </main>
      {!isAdminPage && <Footer />}
    </>
  );
}
