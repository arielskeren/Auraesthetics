import Link from 'next/link';
import EmailCapture from './EmailCapture';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-sand">
      {/* Email Capture Section */}
      <div className="container mx-auto px-6 md:px-12 max-w-7xl py-8">
        <EmailCapture />
      </div>

      {/* Footer Content */}
      <div className="border-t border-taupe/30">
        <div className="container mx-auto px-6 md:px-12 max-w-7xl py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <h3 className="text-2xl font-serif text-charcoal mb-2">Aura Wellness Aesthetics</h3>
              <p className="text-warm-gray text-sm leading-relaxed">
                Bohemian, serene skincare studio by Amy. Customized facials, brows, and gentle advanced treatments.
              </p>
            </div>

            {/* Studio Info */}
            <div>
              <h4 className="text-lg font-serif text-charcoal mb-2">Studio</h4>
              <div className="space-y-2 text-sm text-warm-gray">
                <p>
                  <span className="font-medium">Location:</span> Fort Lauderdale, FL
                </p>
                <p className="text-xs">Servicing all of South Florida</p>
                <p>
                  <span className="font-medium">Hours:</span> By appointment only
                </p>
                <p>
                  <span className="font-medium">Parking:</span> Available on-site
                </p>
                <p>
                  <span className="font-medium">Email:</span> hello@auraesthetics.com
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-serif text-charcoal mb-2">Quick Links</h4>
              <nav className="space-y-2">
                <Link href="/about" className="block text-sm text-warm-gray hover:text-charcoal transition-colors">
                  About Amy
                </Link>
                <Link href="/services" className="block text-sm text-warm-gray hover:text-charcoal transition-colors">
                  Services
                </Link>
                <Link href="/faq" className="block text-sm text-warm-gray hover:text-charcoal transition-colors">
                  FAQ
                </Link>
                <Link href="/forms" className="block text-sm text-warm-gray hover:text-charcoal transition-colors">
                  Forms
                </Link>
                <Link href="/contact" className="block text-sm text-warm-gray hover:text-charcoal transition-colors">
                  Contact
                </Link>
              </nav>
            </div>
          </div>

          {/* Social & Legal */}
          <div className="mt-6 pt-4 border-t border-taupe/30 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex space-x-6">
              <a 
                href="https://instagram.com/auraesthetics" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-warm-gray hover:text-charcoal transition-colors text-sm"
                aria-label="Follow us on Instagram"
              >
                Instagram
              </a>
              <a 
                href="https://tiktok.com/@auraesthetics" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-warm-gray hover:text-charcoal transition-colors text-sm"
                aria-label="Follow us on TikTok"
              >
                TikTok
              </a>
            </div>

            <div className="flex space-x-6 text-xs text-warm-gray">
              <Link href="/privacy" className="hover:text-charcoal transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-charcoal transition-colors">
                Terms of Service
              </Link>
            </div>

            <p className="text-xs text-warm-gray">
              © {currentYear} Aura Wellness Aesthetics. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

