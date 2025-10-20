'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DisabledNotice from './DisabledNotice';

export default function Nav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/services', label: 'Services' },
    { href: '/forms', label: 'Forms' },
    { href: '/faq', label: 'FAQ' },
  ];

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          isScrolled ? 'bg-ivory/95 backdrop-blur-sm shadow-sm' : 'bg-ivory'
        }`}
        initial={{ y: 0 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="container mx-auto px-6 md:px-12 max-w-7xl">
          <div className="flex justify-between items-center py-2">
            {/* Logo/Brand */}
            <Link href="/" className="text-2xl md:text-3xl font-serif text-charcoal hover:text-sage transition-colors">
              Aura Wellness Aesthetics
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm uppercase tracking-wider transition-colors relative group ${
                    pathname === link.href ? 'text-charcoal' : 'text-warm-gray hover:text-charcoal'
                  }`}
                >
                  {link.label}
                  <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-sage transform origin-left transition-transform ${
                    pathname === link.href ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  }`} />
                </Link>
              ))}
              <Link href="/book">
                <DisabledNotice label="Book" />
              </Link>
            </div>

            {/* Mobile Nav */}
            <div className="md:hidden flex items-center space-x-4">
              <Link href="/book">
                <DisabledNotice label="Book" />
              </Link>
            </div>
          </div>

          {/* Mobile Menu Links */}
          <div className="md:hidden pb-2 flex flex-wrap gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-xs uppercase tracking-wider transition-colors ${
                  pathname === link.href ? 'text-charcoal' : 'text-warm-gray'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </motion.nav>
      
      {/* Spacer to prevent content from hiding under fixed nav */}
      <div className="h-16 md:h-20" />
    </>
  );
}

