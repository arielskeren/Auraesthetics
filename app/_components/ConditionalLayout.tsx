'use client';

import Nav from './Nav';
import Footer from './Footer';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
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
