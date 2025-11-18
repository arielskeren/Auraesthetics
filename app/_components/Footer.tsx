import Link from 'next/link';
import EmailCaptureCompact from './EmailCaptureCompact';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-sand relative overflow-hidden">
      {/* Green background accents */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-sage/10 via-transparent to-sage-dark/8" />
      {/* Top decorative line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/50 to-transparent" />
      
      {/* Footer Content */}
      <div className="container mx-auto px-6 md:px-12 max-w-7xl py-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Email Capture - Compact Version */}
          <div>
            <EmailCaptureCompact />
          </div>

          {/* Brand */}
          <div>
            <h3 className="text-2xl font-serif text-charcoal mb-2">Aura Wellness Aesthetics</h3>
            <p className="text-warm-gray text-sm leading-relaxed">
              Wellness to your aura skincare studio by Amy. Customized facials, brows, and gentle advanced treatments.
            </p>
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
              href="https://instagram.com/wellnessesthetics_" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-warm-gray hover:text-charcoal transition-colors text-sm"
              aria-label="Follow us on Instagram"
            >
              Instagram
            </a>
            <a 
              href="https://tiktok.com/@wellnessaesthetics_" 
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
            {/* Secret admin links - subtle but discoverable */}
            <span className="text-warm-gray/30">•</span>
            <Link 
              href="/admindash/amy" 
              className="hover:text-charcoal transition-colors opacity-40 hover:opacity-100"
              title="Admin Dashboard"
            >
              Admin
            </Link>
            <Link 
              href="/admindash/amy/hapio" 
              className="hover:text-charcoal transition-colors opacity-40 hover:opacity-100"
              title="Internal Dashboard"
            >
              Internal
            </Link>
          </div>

          <p className="text-xs text-warm-gray">
            © {currentYear} Aura Wellness Aesthetics. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

